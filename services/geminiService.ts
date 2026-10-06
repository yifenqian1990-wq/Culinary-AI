
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Recipe, CustomEndpoint, CookingPlan, MealType } from "../types";
import { db } from "../db";

export type GenerateMode = 'name' | 'ingredients' | 'image' | 'recommend';

/**
 * 健壮的 JSON 提取函数
 */
function extractJson(text: string): any {
  if (!text) return null;
  const cleanText = text.trim();
  
  try {
    return JSON.parse(cleanText);
  } catch (e) {}

  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = codeBlockRegex.exec(cleanText)) !== null) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {}
  }

  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    const jsonCandidate = cleanText.substring(firstBrace, lastBrace + 1);
    try {
      const sanitized = jsonCandidate.replace(/\/\/.*/g, "");
      return JSON.parse(sanitized);
    } catch (e) {}
  }
  
  return null;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
      if (isRateLimit && i < maxRetries) {
        const delay = (initialDelay * Math.pow(2, i)) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function smartAiCall(
  payload: any, 
  preferredModel: string = 'gemini-3-flash-preview'
): Promise<GenerateContentResponse> {
  const activeCustom = await db.customEndpoints.where('isActive').equals(1).first();
  if (activeCustom) {
    return await callCustomOpenAiEndpoint(activeCustom, payload);
  }

  const userKeyRecord = await db.apiKeys.where('isActive').equals(1).first();
  const apiKeyToUse = userKeyRecord?.key || process.env.API_KEY;

  if (!apiKeyToUse) {
    throw new Error("未检测到 API Key，请在设置中配置。");
  }

  return await retryWithBackoff(async () => {
    const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
    return await ai.models.generateContent({
      model: preferredModel,
      ...payload
    });
  });
}

async function callCustomOpenAiEndpoint(endpoint: CustomEndpoint, payload: any): Promise<GenerateContentResponse> {
  const messages = [];
  if (payload.config?.systemInstruction) {
    messages.push({ role: 'system', content: payload.config.systemInstruction });
  }
  let userContent = "";
  if (typeof payload.contents === 'string') userContent = payload.contents;
  else if (Array.isArray(payload.contents)) userContent = payload.contents[0].parts[0].text;
  else userContent = payload.contents.parts[0].text;

  messages.push({ role: 'user', content: userContent });
  
  const response = await fetch(`${endpoint.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${endpoint.apiKey}` },
    body: JSON.stringify({
      model: endpoint.modelId,
      messages: messages,
      temperature: 0.7,
      response_format: payload.config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return { text, candidates: [{ content: { parts: [{ text }] } }] } as any;
}

export interface RecommendedDish {
  name: string;
  description: string;
  quickRecipe?: Partial<Recipe>;
}

export async function fetchDishRecommendations(
  input: string,
  mode: GenerateMode,
  imageData?: string,
  recommendSimilar: boolean = true,
  excludeNames: string[] = []
): Promise<{ recommendations: RecommendedDish[] }> {
  const instruction = `你是顶级厨艺大师。根据输入推荐3个方案。
  **关键要求：每个方案都必须包含一个极致详细的 quickRecipe 对象，确保用户点击后能立即开始烹饪。**
  
  quickRecipe 必须包含：
  1. ingredients: 数组，必须包含精确用量(g/ml)和预处理说明。
  2. steps: 数组，每一步必须包含明确的时间(如: 煎2分钟)和火力提示。
  3. notes: 字符串，包含大厨提示和注意事项。
  4. category: 对应分类名。
  5. description: 菜品卖点简介。
  
  直接返回 JSON 格式。`;

  let prompt = "";
  switch (mode) {
    case 'name': prompt = `关于“${input}”，推荐3个深度方案。`; break;
    case 'ingredients': prompt = `现有食材“${input}”，推荐3道能发挥食材特色的菜。`; break;
    case 'image': prompt = `识别图中食材并推荐3道最适合的菜。`; break;
    case 'recommend': prompt = `根据偏好“${input}”，推荐3道惊艳的菜。`; break;
  }

  const response = await smartAiCall({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: `${instruction} ${prompt}` }] }],
    config: {
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                quickRecipe: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    category: { type: Type.STRING },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    notes: { type: Type.STRING }
                  },
                  required: ["name", "ingredients", "steps"]
                }
              },
              required: ["name", "description", "quickRecipe"]
            }
          }
        },
        required: ["recommendations"]
      }
    }
  });

  return extractJson(response.text) || { recommendations: [] };
}

export async function fetchRecipeDetailFromAI(dishName: string): Promise<{ recipe: Partial<Recipe>, sources: { title: string; uri: string }[] }> {
  const prompt = `你是五星级大厨。请联网搜索并整理“${dishName}”的详细专业菜谱。
  
  ### 强制格式要求：
  1. 必须返回 JSON 格式，严禁注释。
  2. 包含字段：name, category, description, ingredients (数组, 含用量), steps (数组, 含耗时), notes (注意事项)。
  3. **必须将 JSON 放在 \`\`\`json [内容] \`\`\` 代码块中。**
  
  请开始联网检索。`;
  
  const response = await smartAiCall({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
    config: { 
        tools: [{ googleSearch: {} }],
        temperature: 0.2 
    },
  });
  
  const rawText = response.text || '';
  const recipeData = extractJson(rawText) || {};
  
  const sources: { title: string; uri: string }[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) sources.push({ title: chunk.web.title || "参考来源", uri: chunk.web.uri });
    });
  }
  return { recipe: recipeData, sources };
}

export async function generateWeeklyPlan(preference: string): Promise<{ plans: Partial<CookingPlan>[] }> {
  const response = await smartAiCall({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: `为偏好“${preference}”规划饮食。` }] }],
    config: { 
      systemInstruction: "返回 JSON 格式的 plans 数组。不要加注释。", 
      responseMimeType: "application/json" 
    }
  });
  return extractJson(response.text) || { plans: [] };
}

export async function categorizeIngredientsAI(ingredients: string[]): Promise<Record<string, string[]>> {
  const systemInstruction = `食材分类专家。返回 JSON 对象。不要加注释。`;
  const response = await smartAiCall({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: `请分类：${ingredients.join(', ')}` }] }],
    config: { systemInstruction, responseMimeType: "application/json" }
  });
  return extractJson(response.text) || {};
}


export type RecipeCategory = string;
export type MealType = '早餐' | '午餐' | '晚餐' | '宵夜';

export const MEAL_TYPES: MealType[] = ['早餐', '午餐', '晚餐', '宵夜'];

export interface Category {
  id?: number;
  name: string;
  order: number;
}

export interface Recipe {
  id?: number;
  name: string;
  category: RecipeCategory;
  description: string;
  ingredients: string[];
  steps: string[];
  notes?: string; // 增加注意事项字段
  photo?: string;
  createdAt: number;
  updatedAt?: number;
  isFavorite?: boolean;
  isArchived?: 0 | 1;
  order?: number;
  sources?: { title: string; uri: string }[];
}

export interface CookingRecord {
  id?: number;
  recipeId: number;
  recipeName: string;
  status: 'pending' | 'completed';
  cookedAt?: number;
  addedAt: number;
}

export interface CookingPlanGroup {
  id?: number;
  name: string;
  createdAt: number;
  isArchived: 0 | 1;
}

export interface CookingPlan {
  id?: number;
  groupId: number; // Link to CookingPlanGroup
  recipeId: number;
  recipeName: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
}

export enum ModelProvider {
  GEMINI = 'GEMINI',
  CUSTOM = 'CUSTOM'
}

export interface AIModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  modelName: string;
  isActive: 0 | 1;
  priority: number;
}

export interface ApiKey {
  id?: number;
  label: string;
  key: string;
  isActive: 0 | 1;
  createdAt: number;
  lastUsed?: number;
  status: 'valid' | 'invalid' | 'unknown';
}

export interface CustomEndpoint {
  id?: number;
  name: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  isActive: 0 | 1;
  createdAt: number;
}

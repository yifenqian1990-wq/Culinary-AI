
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import { Recipe, RecipeCategory } from '../types';
import { fetchDishRecommendations, fetchRecipeDetailFromAI, GenerateMode, RecommendedDish } from '../services/geminiService';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sparkles, Camera, Loader2, X, UtensilsCrossed, ChefHat, ImageIcon, Check, Wand2, Heart, Globe, ArrowRight, MousePointer2, AlertCircle, RefreshCw, SearchCode, ShieldAlert, Plus, ListPlus, Zap, Info } from 'lucide-react';

interface Props {
  initialData?: Recipe;
  onSuccess: () => void;
  onCancel: () => void;
}

export const RecipeForm: React.FC<Props> = ({ initialData, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [selectingName, setSelectingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genMode, setGenMode] = useState<GenerateMode>('name');
  const [loadingStep, setLoadingStep] = useState(0);
  const [recommendSimilar, setRecommendSimilar] = useState(true);
  
  const [recommendations, setRecommendations] = useState<RecommendedDish[] | null>(null);

  const [dishName, setDishName] = useState(initialData?.name || '');
  const [category, setCategory] = useState<RecipeCategory>(initialData?.category || '其他');
  const [description, setDescription] = useState(initialData?.description || '');
  const [ingredients, setIngredients] = useState<string[]>(initialData?.ingredients || ['']);
  const [steps, setSteps] = useState<string[]>(initialData?.steps || ['']);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [photo, setPhoto] = useState<string | null>(initialData?.photo || null);
  const [sources, setSources] = useState(initialData?.sources || []);
  const [isFavorite, setIsFavorite] = useState(initialData?.isFavorite || false);
  
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiImageRef = useRef<HTMLInputElement>(null);
  const [aiPreviewImage, setAiPreviewImage] = useState<string | null>(null);

  const loadingMessages = [
    "Gemini 3 正在深度扫描...",
    "正在提取大师秘方...",
    "整理步骤与精准用量...",
    "即将为您呈献地道美味..."
  ];

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep(s => (s + 1) % loadingMessages.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGetRecommendations = async () => {
    if (!dishName && genMode !== 'image') return;
    setLoading(true);
    setError(null);
    try {
      const { recommendations: items } = await fetchDishRecommendations(
        dishName, 
        genMode, 
        aiPreviewImage || undefined,
        recommendSimilar
      );
      setRecommendations(items);
      // 如果不是为了“推荐相似”，而是为了直接获取做法，且 AI 直接返回了数据
      if (!recommendSimilar && items.length > 0 && items[0].quickRecipe) {
         applyRecipeData(items[0].quickRecipe);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecommendation = async (rec: RecommendedDish) => {
    // 核心优化：如果已有完整方案，直接填入，不再联网搜索
    if (rec.quickRecipe && rec.quickRecipe.ingredients && rec.quickRecipe.steps) {
      applyRecipeData(rec.quickRecipe);
      if (genMode === 'image' && aiPreviewImage) setPhoto(aiPreviewImage);
      setRecommendations(null);
      return;
    }

    setSelectingName(rec.name);
    setError(null);
    
    try {
      const { recipe, sources: aiSources } = await fetchRecipeDetailFromAI(rec.name);
      if (recipe && Object.keys(recipe).length > 0) {
        applyRecipeData(recipe, aiSources);
        if (genMode === 'image' && aiPreviewImage) setPhoto(aiPreviewImage);
        setRecommendations(null);
      } else {
        throw new Error("AI 解析结果为空，请重试或检查 API 配置。");
      }
    } catch (err: any) {
      setError(`获取详情失败: ${err.message}`);
    } finally {
      setSelectingName(null);
    }
  };

  const applyRecipeData = (recipe: Partial<Recipe>, newSources?: any[]) => {
    if (recipe.name) setDishName(recipe.name);
    if (recipe.description) setDescription(recipe.description);
    if (recipe.category) setCategory(recipe.category);
    if (recipe.notes) setNotes(recipe.notes);
    
    if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
      setIngredients(recipe.ingredients);
    }
    if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
      setSteps(recipe.steps);
    }
    if (newSources && newSources.length > 0) {
      setSources(newSources);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'recipe' | 'ai') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'recipe') setPhoto(reader.result as string);
        else setAiPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName) return;
    const now = Date.now();
    const data: Recipe = {
      name: dishName, category, description,
      ingredients: ingredients.filter(i => i.trim()),
      steps: steps.filter(s => s.trim()),
      notes: notes.trim() || undefined,
      photo: photo || undefined,
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      isFavorite,
      isArchived: 0,
      sources: sources.length > 0 ? sources : undefined
    };
    if (initialData?.id) await db.recipes.update(initialData.id, data);
    else await db.recipes.add(data);
    onSuccess();
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-orange-100 max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="p-8 bg-gradient-to-r from-orange-50 to-transparent border-b border-orange-100 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-100">
               <Wand2 className="w-5 h-5" />
            </div>
            <h2 className="text-3xl font-black font-serif text-gray-800">AI 创作菜谱</h2>
          </div>
          <div className="flex items-center gap-1.5 mt-2 ml-1">
            <Globe className="w-3 h-3 text-orange-400" />
            <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest">
              Gemini 3 Flash 实时生成
            </p>
          </div>
        </div>
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-all group">
          <X className="w-6 h-6 text-gray-300 group-hover:text-gray-600" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-10 max-h-[85vh] overflow-y-auto custom-scrollbar">
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-orange-100 shadow-sm space-y-8 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex bg-orange-50 p-1 rounded-2xl border border-orange-100/50">
              {[
                { id: 'name', label: '搜菜名', icon: <ChefHat className="w-4 h-4" /> },
                { id: 'ingredients', label: '配食材', icon: <UtensilsCrossed className="w-4 h-4" /> },
                { id: 'image', label: '图识味', icon: <ImageIcon className="w-4 h-4" /> },
                { id: 'recommend', label: '荐口味', icon: <Sparkles className="w-4 h-4" /> },
              ].map(opt => (
                <button 
                  key={opt.id} type="button" 
                  onClick={() => { setGenMode(opt.id as GenerateMode); setRecommendations(null); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${genMode === opt.id ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-300 hover:text-orange-500'}`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
            <button 
              type="button" onClick={handleGetRecommendations} disabled={loading}
              className="px-10 h-16 bg-black text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-gray-800 transition-all disabled:opacity-30"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? '检索方案中...' : '生成 3 套完整方案'}
            </button>
          </div>

          <div className="flex gap-4 items-center">
            {genMode === 'image' && (
              <div onClick={() => aiImageRef.current?.click()} className="w-24 h-16 bg-gray-50 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden">
                {aiPreviewImage ? <img src={aiPreviewImage} className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-gray-200" />}
                <input ref={aiImageRef} type="file" className="hidden" onChange={e => handlePhotoUpload(e, 'ai')} />
              </div>
            )}
            <input 
              value={dishName} onChange={e => setDishName(e.target.value)}
              className="flex-1 h-16 px-8 rounded-2xl bg-orange-50/50 border-none focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all font-bold text-gray-700 shadow-inner"
              placeholder="输入菜名、食材或口味要求..."
            />
          </div>

          {error && (
            <div className="bg-red-50 p-4 rounded-xl flex items-start gap-3 border border-red-100 animate-in fade-in">
              <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-red-600 font-bold">{error}</p>
                <button onClick={handleGetRecommendations} className="mt-2 text-[10px] font-black text-red-500 flex items-center gap-1 hover:underline"><RefreshCw className="w-3 h-3" /> 重试</button>
              </div>
            </div>
          )}

          {loading && !selectingName && (
             <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                <p className="text-xs font-black text-gray-400 animate-pulse">{loadingMessages[loadingStep]}</p>
             </div>
          )}

          {recommendations && recommendations.length > 0 && (
            <div className="pt-6 border-t border-orange-50 animate-in fade-in slide-in-from-top-4">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
                 <Zap className="w-3 h-3 text-orange-500" /> AI 极速方案 (点击直接填入)：
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {recommendations.map((rec, i) => (
                   <div 
                    key={i} 
                    onClick={() => !selectingName && handleSelectRecommendation(rec)}
                    className={`p-5 bg-white border rounded-2xl transition-all cursor-pointer relative group ${selectingName === rec.name ? 'border-orange-500 ring-2 ring-orange-100' : 'border-orange-50 hover:border-orange-500 hover:shadow-lg'}`}
                   >
                     {selectingName === rec.name && (
                       <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-10">
                         <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                       </div>
                     )}
                     <div className="flex items-center justify-between mb-2">
                       <h4 className="font-black text-gray-800 text-sm">{rec.name}</h4>
                       <div className="p-1 bg-orange-50 rounded-lg text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                         <ArrowRight className="w-3 h-3" />
                       </div>
                     </div>
                     <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2">{rec.description}</p>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <input value={dishName} onChange={e => setDishName(e.target.value)} className="w-full px-6 py-5 rounded-2xl bg-gray-50 border-none outline-none focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all text-xl font-black" placeholder="菜谱名称..." />
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-bold text-gray-700 outline-none">
              {categories?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 min-h-[120px] outline-none font-medium" placeholder="菜品简介..." />
          </div>
          <div onClick={() => fileInputRef.current?.click()} className="aspect-video bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-orange-200 hover:bg-orange-50/20 transition-all">
            {photo ? <img src={photo} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-2"><ImageIcon className="w-10 h-10 text-gray-200" /><p className="text-gray-300 font-bold">成品照片</p></div>}
            <input ref={fileInputRef} type="file" className="hidden" onChange={e => handlePhotoUpload(e, 'recipe')} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className="flex justify-between items-center"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><UtensilsCrossed className="w-3 h-3" /> 食材清单</label><button type="button" onClick={() => setIngredients([...ingredients, ''])} className="text-orange-500 text-[10px] font-black hover:underline">+ 添加</button></div>
            <div className="space-y-3">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input value={ing} onChange={e => { const n = [...ingredients]; n[i] = e.target.value; setIngredients(n); }} className="flex-1 px-5 py-3 rounded-xl bg-gray-50 border-none font-bold outline-none focus:bg-white" placeholder="如: 鸡蛋 2个" />
                  <button type="button" onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="p-2 text-gray-200 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><ChefHat className="w-3 h-3" /> 烹饪步骤</label><button type="button" onClick={() => setSteps([...steps, ''])} className="text-orange-500 text-[10px] font-black hover:underline">+ 添加</button></div>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-2">{i+1}</div>
                  <textarea value={step} onChange={e => { const n = [...steps]; n[i] = e.target.value; setSteps(n); }} className="flex-1 px-5 py-3 rounded-xl bg-gray-50 border-none font-medium outline-none h-24 focus:bg-white" placeholder={`步骤描述...`} />
                  <button type="button" onClick={() => setSteps(steps.filter((_, idx) => idx !== i))} className="p-2 text-gray-200 hover:text-red-500 h-8 mt-2"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Info className="w-3 h-3" /> 大厨提示 / 注意事项</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-orange-50/20 border border-orange-100 outline-none font-medium min-h-[100px] focus:bg-white focus:ring-2 focus:ring-orange-100" placeholder="例如：腌制时间不要超过15分钟，否则肉质会变老..." />
        </div>

        <button type="submit" className="w-full h-20 rounded-2xl bg-black text-white font-black shadow-2xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3">
          <Check className="w-6 h-6" /> 保存至我的菜库
        </button>
      </form>
    </div>
  );
};


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, initializeDb, exportAllData, importAllData, ShoppingItem } from './db';
import { Recipe, RecipeCategory, CookingRecord, CookingPlan, CookingPlanGroup, MEAL_TYPES, MealType, Category } from './types';
import { useLiveQuery } from 'dexie-react-hooks';
import { KeyManager } from './components/KeyManager';
import { DataManager } from './components/DataManager';
import { ArchiveManager } from './components/ArchiveManager';
import { RecipeForm } from './components/RecipeForm';
import { CustomEndpointManager } from './components/CustomEndpointManager';
// Fix: Removed non-existent import processSmartCommand
import { generateWeeklyPlan, categorizeIngredientsAI } from './services/geminiService';
import { 
  PlusCircle, Utensils, Search, Settings, 
  BookOpen, Clock, Trash2, X, 
  Copy, Edit2, ShoppingCart, CheckCircle, History, ExternalLink, Camera, Loader2, Calendar, CalendarPlus, ListChecks, Sparkles, Wand2, MessageSquare, Bot, LayoutGrid, List, ArrowUpDown, ChevronDown,
  ChefHat, Check, Link as LinkIcon, Database, Heart, Archive, ArchiveRestore, Tag, Folder, FolderPlus, FolderCheck, ChevronRight, LayoutList, ListPlus, Edit3, Zap, AlertTriangle, MessageCircle, Server, MousePointer2, GripVertical, Settings2, Plus, ArrowLeft, CalendarDays, MoreVertical, FileDown, ShoppingBag, MapPin, Printer, Filter, ZoomIn, Layers, Pencil, Move, Save, CheckSquare, Square, MoreHorizontal, ImagePlus, ChevronUp, Play, Pause, RotateCcw, Timer as TimerIcon, Trophy, ClipboardList, Info
} from 'lucide-react';

type SortOption = 'createdAt' | 'updatedAt' | 'name' | 'favorite' | 'manual';

// 计时器组件
const StepTimer: React.FC<{ initialSeconds: number }> = ({ initialSeconds }) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, timeLeft]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggle = () => setIsActive(!isActive);
  const reset = () => { setIsActive(false); setTimeLeft(initialSeconds); };

  return (
    <div className="inline-flex items-center gap-3 bg-orange-600 px-4 py-2.5 rounded-2xl shadow-lg shadow-orange-200 animate-in zoom-in-95 duration-300">
      <TimerIcon className={`w-4 h-4 ${isActive ? 'text-white animate-pulse' : 'text-orange-200'}`} />
      <span className="font-mono font-black text-sm text-white min-w-[50px] text-center">
        {formatTime(timeLeft)}
      </span>
      <div className="flex gap-2 ml-1">
        <button onClick={toggle} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-xl transition-colors text-white">
          {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button onClick={reset} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white/60">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'settings' | 'add' | 'order' | 'plan'>('home');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<RecipeCategory | '全部'>('全部');
  const [sortBy, setSortBy] = useState<SortOption>('manual');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isAiWorking, setIsAiWorking] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'syncing' | 'error'>('syncing');

  // 烹饪模式状态
  const [isCookingMode, setIsCookingMode] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // 批量管理状态
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<number>>(new Set());
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // 分类与计划
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [selectedPlanGroup, setSelectedPlanGroup] = useState<CookingPlanGroup | null>(null);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 计划添加相关状态
  const [isPlanAddOpen, setIsPlanAddOpen] = useState(false);
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
  const [planMeal, setPlanMeal] = useState<MealType>('晚餐');

  // 查询数据
  const rawRecipes = useLiveQuery(() => db.recipes.toArray());
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const cookingQueue = useLiveQuery(() => db.cookingRecords.where('status').equals('pending').toArray());
  const shoppingItems = useLiveQuery(() => db.shoppingItems.orderBy('addedAt').toArray());
  const planGroups = useLiveQuery(() => db.cookingPlanGroups.filter(g => g.isArchived === 0).toArray());
  
  const activeGroupPlans = useLiveQuery(() => {
    if (selectedPlanGroup?.id) {
      return db.cookingPlans.where('groupId').equals(selectedPlanGroup.id).toArray();
    }
    return [] as CookingPlan[];
  }, [selectedPlanGroup]);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDb();
        setDbStatus('connected');
      } catch (e) { setDbStatus('error'); }
    };
    init();
  }, []);

  const toggleCookingStep = (index: number) => {
    const next = new Set(completedSteps);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setCompletedSteps(next);
  };

  const cookingProgress = useMemo(() => {
    if (!selectedRecipe || selectedRecipe.steps.length === 0) return 0;
    return Math.round((completedSteps.size / selectedRecipe.steps.length) * 100);
  }, [selectedRecipe, completedSteps]);

  const parseStepTime = (text: string): number | null => {
    const minMatch = text.match(/(\d+)\s*(分钟|min|分)/i);
    const hourMatch = text.match(/(\d+)\s*(小时|hour|h)/i);
    const secMatch = text.match(/(\d+)\s*(秒|sec|s)/i);
    let totalSeconds = 0;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    return totalSeconds > 0 ? totalSeconds : null;
  };

  const addRecipeToPurchase = async (recipe: Recipe) => {
    await db.cookingRecords.add({
      recipeId: recipe.id || -1,
      recipeName: recipe.name,
      status: 'pending',
      addedAt: Date.now()
    });
    const items = recipe.ingredients.map(ing => ({
      name: ing,
      category: '未分类',
      isChecked: 0 as const,
      addedAt: Date.now()
    }));
    await db.shoppingItems.bulkAdd(items);
    alert('菜品及所需食材已同步至采购清单');
  };

  const handleCategorizeShopping = async () => {
    const uncategorized = shoppingItems?.filter(i => i.category === '未分类') || [];
    if (uncategorized.length === 0) {
      alert('没有需要分类的未归类食材。');
      return;
    }
    setIsCategorizing(true);
    try {
      const names = uncategorized.map(i => i.name);
      const result = await categorizeIngredientsAI(names);
      await db.transaction('rw', db.shoppingItems, async () => {
        for (const [catName, itemNames] of Object.entries(result)) {
          const namesArray = Array.isArray(itemNames) ? itemNames : [];
          const idsToUpdate = uncategorized
            .filter(ui => namesArray.some(n => ui.name.includes(n) || n.includes(ui.name)))
            .map(ui => ui.id!);
          if (idsToUpdate.length > 0) {
            await db.shoppingItems.where('id').anyOf(idsToUpdate).modify({ category: catName });
          }
        }
      });
    } catch (e) { 
      alert('AI 分类失败，请检查网络或 API Key 设置'); 
    } finally { 
      setIsCategorizing(false); 
    }
  };

  const handleSummarizePlanIngredients = async () => {
    if (!selectedPlanGroup || !activeGroupPlans || activeGroupPlans.length === 0) return;
    
    setIsSummarizing(true);
    try {
      const allIngredients: string[] = [];
      const recipesToProcess: string[] = [];

      for (const plan of activeGroupPlans) {
        let recipe: Recipe | undefined;
        if (plan.recipeId !== -1) {
          recipe = await db.recipes.get(plan.recipeId);
        } else {
          // 如果是手动输入的菜名，尝试从库中找同名
          recipe = await db.recipes.where('name').equals(plan.recipeName).first();
        }

        if (recipe) {
          allIngredients.push(...recipe.ingredients);
          recipesToProcess.push(recipe.name);
        }
      }

      if (allIngredients.length === 0) {
        alert("这些菜品还没有录入食材，无法汇总。");
        return;
      }

      // 录入采购清单
      const items = [...new Set(allIngredients)].map(ing => ({
        name: ing,
        category: '未分类',
        isChecked: 0 as const,
        addedAt: Date.now()
      }));

      await db.shoppingItems.bulkAdd(items);
      alert(`已成功汇总 ${recipesToProcess.length} 道菜的食材并添加到采购清单。`);
      setView('order');
    } catch (e) {
      alert("汇总失败，请重试。");
    } finally {
      setIsSummarizing(false);
    }
  };

  const shoppingByCat = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    shoppingItems?.forEach(item => {
      const cat = item.category || '未分类';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === '未分类') return 1;
      if (b === '未分类') return -1;
      return a.localeCompare(b);
    });
  }, [shoppingItems]);

  const plansByDate = useMemo(() => {
    const grouped: Record<string, CookingPlan[]> = {};
    activeGroupPlans?.forEach(p => {
      if (!grouped[p.date]) grouped[p.date] = [];
      grouped[p.date].push(p);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [activeGroupPlans]);

  const recipes = useMemo(() => {
    if (!rawRecipes) return [];
    let filtered = rawRecipes.filter(r => {
      const isNotArchived = r.isArchived !== 1;
      const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = filterCategory === '全部' || r.category === filterCategory;
      return isNotArchived && matchSearch && matchCategory;
    });

    filtered.sort((a, b) => {
      let valA: any = a[sortBy as keyof Recipe] || 0;
      let valB: any = b[sortBy as keyof Recipe] || 0;
      if (sortBy === 'manual') { valA = a.order || 0; valB = b.order || 0; }
      if (sortBy === 'favorite') { valA = a.isFavorite ? 1 : 0; valB = b.isFavorite ? 1 : 0; }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [rawRecipes, searchQuery, filterCategory, sortBy, sortOrder]);

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return;
    if (editingCat) {
      await db.categories.update(editingCat.id!, { name: newCatName.trim() });
      setEditingCat(null);
    } else {
      const count = await db.categories.count();
      await db.categories.add({ name: newCatName.trim(), order: count });
    }
    setNewCatName('');
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (confirm(`确定删除分类“${cat.name}”吗？`)) {
      await db.categories.delete(cat.id!);
    }
  };

  const handleAiGeneratePlan = async () => {
    const pref = prompt("输入您的饮食偏好 (例如：减脂餐、川菜、3天减碳计划)");
    if (!pref) return;

    setIsAiWorking(true);
    try {
      const result = await generateWeeklyPlan(pref);
      const gid = await db.cookingPlanGroups.add({
        name: `AI 智选: ${pref}`,
        createdAt: Date.now(),
        isArchived: 0
      });
      
      const plansToSave = result.plans.map(p => ({
        ...p,
        groupId: gid,
        recipeId: -1,
        recipeName: p.recipeName || "未命名菜品"
      } as CookingPlan));
      
      await db.cookingPlans.bulkAdd(plansToSave);
      const newGroup = await db.cookingPlanGroups.get(gid);
      if (newGroup) setSelectedPlanGroup(newGroup);
    } catch (e) {
      alert("AI 生成计划失败，请重试。");
    } finally {
      setIsAiWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-gray-900 pb-24 font-sans">
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-orange-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
          <div className="bg-orange-600 p-1.5 rounded-lg shadow-lg shadow-orange-100"><Utensils className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight font-serif">私厨笔记</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
               <div className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-green-500' : 'bg-orange-400 animate-pulse'}`}></div>
               <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Gemini 3 驱动</span>
            </div>
          </div>
        </div>
        <nav className="flex gap-1 items-center bg-gray-100/50 p-1 rounded-full">
          {[{ id: 'home', icon: BookOpen, label: '菜库' }, { id: 'plan', icon: Calendar, label: '计划' }, { id: 'order', icon: ShoppingBag, label: '清单' }, { id: 'settings', icon: Settings, label: '设置' }].map(item => (
            <button key={item.id} onClick={() => { setView(item.id as any); setSelectedPlanGroup(null); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${view === item.id ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <item.icon className="w-4 h-4" />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === 'settings' ? (
          <div className="space-y-16"><KeyManager /><CustomEndpointManager /><ArchiveManager /><DataManager /></div>
        ) : 
         view === 'add' ? <RecipeForm initialData={editingRecipe} onSuccess={() => {setView('home'); setEditingRecipe(undefined);}} onCancel={() => {setView('home'); setEditingRecipe(undefined);}} /> :
         view === 'order' ? (
            <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500">
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                 <div><h2 className="text-3xl font-black font-serif mb-2">采购清单</h2><p className="text-xs text-gray-400 font-bold uppercase tracking-widest">支持 AI 智能自动归类食材</p></div>
                 <div className="flex gap-3">
                   <button onClick={handleCategorizeShopping} disabled={isCategorizing} className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-orange-100 flex items-center gap-2 disabled:opacity-50 hover:bg-orange-700 transition-all">
                     {isCategorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI 智能分类
                   </button>
                   <button onClick={() => { if(confirm('确定清理已勾选项目？')) db.shoppingItems.where('isChecked').equals(1).delete(); }} className="px-6 py-3 bg-gray-100 text-gray-400 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-gray-200 transition-colors"><Trash2 className="w-4 h-4" /> 清理已购</button>
                 </div>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                 <div className="lg:col-span-4">
                    <div className="bg-white p-8 rounded-[3rem] border border-orange-50 shadow-sm space-y-6">
                       <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><ChefHat className="w-4 h-4" /> 待购食材归属菜品</h3>
                       <div className="space-y-3">
                         {cookingQueue?.map(record => (
                           <div key={record.id} className="group flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                              <span className="font-bold text-gray-800 text-sm">{record.recipeName}</span>
                              <button onClick={() => db.cookingRecords.delete(record.id!)} className="p-2 text-gray-200 hover:text-red-500"><X className="w-4 h-4" /></button>
                           </div>
                         ))}
                       </div>
                    </div>
                 </div>
                 <div className="lg:col-span-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {shoppingByCat.map(([cat, items]) => (
                         <div key={cat} className="bg-white p-8 rounded-[3rem] border border-orange-50 shadow-sm space-y-6">
                            <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest flex items-center gap-2"><Tag className="w-4 h-4" /> {cat}</h3>
                            <div className="space-y-3">
                               {items.map(item => (
                                 <label key={item.id} className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                      <button onClick={() => db.shoppingItems.update(item.id!, { isChecked: item.isChecked === 1 ? 0 : 1 })} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${item.isChecked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-100'}`}><Check className="w-3.5 h-3.5" /></button>
                                      <span className={`text-sm font-bold ${item.isChecked ? 'text-gray-300 line-through' : 'text-gray-700'}`}>{item.name}</span>
                                    </div>
                                    <button onClick={() => db.shoppingItems.delete(item.id!)} className="p-2 text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                 </label>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               </div>
            </div>
         ) : view === 'plan' ? (
           <div className="space-y-8 animate-in fade-in duration-500">
             {selectedPlanGroup ? (
               <div className="space-y-8">
                 <div className="flex items-center justify-between">
                    <button onClick={() => setSelectedPlanGroup(null)} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-orange-600 transition-colors"><ArrowLeft className="w-4 h-4" /> 返回计划列表</button>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleSummarizePlanIngredients} 
                        disabled={isSummarizing}
                        className="px-6 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-black shadow-lg shadow-orange-100 flex items-center gap-2 hover:bg-orange-700 transition-all disabled:opacity-50"
                      >
                        {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} 一键汇总食材
                      </button>
                      <button onClick={() => { if(confirm('确定删除此计划组？')) { db.cookingPlanGroups.delete(selectedPlanGroup.id!); setSelectedPlanGroup(null); } }} className="p-2.5 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                    </div>
                 </div>
                 <div className="bg-white p-10 rounded-[4rem] border border-orange-100 shadow-xl space-y-10">
                   <h2 className="text-4xl font-black font-serif text-gray-800 border-b border-orange-50 pb-6">{selectedPlanGroup.name}</h2>
                   <div className="space-y-12">
                     {plansByDate.map(([date, plans]) => (
                       <div key={date} className="relative pl-10 border-l-2 border-orange-100 space-y-6">
                          <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-orange-500 border-4 border-white shadow-sm"></div>
                          <div className="flex items-center gap-4">
                            <h3 className="text-xl font-black text-gray-800">{date}</h3>
                            <div className="h-px flex-1 bg-orange-50"></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {plans.map(plan => (
                              <div key={plan.id} className="group bg-orange-50/30 p-6 rounded-3xl border border-orange-100/50 hover:bg-white hover:shadow-xl hover:border-orange-300 transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-orange-600 shadow-sm">{plan.mealType}</span>
                                  <button onClick={() => db.cookingPlans.delete(plan.id!)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                                <h4 className="font-bold text-gray-800">{plan.recipeName}</h4>
                              </div>
                            ))}
                            <button onClick={() => { setPlanDate(date); setIsPlanAddOpen(true); }} className="p-6 rounded-3xl border-2 border-dashed border-orange-100 flex items-center justify-center text-orange-200 hover:text-orange-400 hover:border-orange-400 transition-all"><Plus className="w-8 h-8" /></button>
                          </div>
                       </div>
                     ))}
                     <button onClick={() => { setPlanDate(new Date().toISOString().split('T')[0]); setIsPlanAddOpen(true); }} className="w-full py-10 rounded-[3rem] border-2 border-dashed border-orange-100 flex flex-col items-center justify-center gap-4 text-orange-200 hover:bg-orange-50/50 hover:border-orange-400 hover:text-orange-400 transition-all"><CalendarPlus className="w-10 h-10" /><span className="font-black text-sm">规划新日期</span></button>
                   </div>
                 </div>
               </div>
             ) : (
               <div className="space-y-10">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h2 className="text-4xl font-black font-serif text-gray-800">烹饪计划仪表盘</h2>
                      <p className="text-gray-400 text-sm font-medium mt-1">使用 AI 智能编排您的每日餐点</p>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={handleAiGeneratePlan} disabled={isAiWorking} className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-100 flex items-center gap-3 hover:bg-orange-700 transition-all active:scale-95">
                        {isAiWorking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} AI 智能规划
                      </button>
                      <button onClick={() => { const n = prompt("输入计划组名称 (如: 健身周餐)"); if(n) db.cookingPlanGroups.add({ name: n, createdAt: Date.now(), isArchived: 0 }); }} className="px-8 py-4 bg-black text-white rounded-2xl font-black text-sm shadow-xl shadow-gray-100 flex items-center gap-3 hover:bg-gray-800 transition-all active:scale-95"><FolderPlus className="w-5 h-5" /> 新建计划组</button>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                   {planGroups?.map(group => (
                     <div key={group.id} onClick={() => setSelectedPlanGroup(group)} className="group bg-white p-8 rounded-[3.5rem] border border-orange-50 hover:shadow-2xl hover:border-orange-200 transition-all cursor-pointer relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 -mr-8 -mt-8 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>
                       <div className="relative z-10">
                         <div className="w-16 h-16 bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-6"><Calendar className="w-8 h-8" /></div>
                         <h3 className="text-xl font-black text-gray-800 mb-2">{group.name}</h3>
                         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(group.createdAt).toLocaleDateString()} 创建</p>
                       </div>
                     </div>
                   ))}
                   {(!planGroups || planGroups.length === 0) && (
                     <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-300 gap-4">
                       <Calendar className="w-16 h-16 opacity-10" />
                       <p className="font-black italic">还没有任何烹饪计划，点击上方按钮开始规划。</p>
                     </div>
                   )}
                 </div>
               </div>
             )}
           </div>
         ) : (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="text" placeholder="搜索菜谱..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-3xl bg-white border border-gray-100 shadow-sm outline-none focus:ring-4 focus:ring-orange-100 transition" /></div>
              <div className="flex gap-4 items-center">
                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} className="px-4 py-3 rounded-2xl bg-white border border-gray-100 text-xs font-black text-gray-600 outline-none"><option value="manual">默认排序</option><option value="updatedAt">最近更新</option><option value="name">名称</option><option value="favorite">收藏</option></select>
                <button onClick={() => { setIsBatchMode(!isBatchMode); setSelectedRecipeIds(new Set()); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black transition-all ${isBatchMode ? 'bg-orange-600 text-white' : 'bg-white text-gray-500 border border-gray-100'}`}><ListPlus className="w-4 h-4" /> {isBatchMode ? '取消选择' : '批量管理'}</button>
              </div>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
              <button onClick={() => setFilterCategory('全部')} className={`px-6 py-2.5 rounded-full text-xs font-black transition-all border ${filterCategory === '全部' ? 'bg-orange-600 text-white shadow-xl' : 'bg-white text-gray-500 border-gray-100'}`}>全部</button>
              {categories?.map(cat => (
                <button key={cat.id} onClick={() => setFilterCategory(cat.name)} className={`px-6 py-2.5 rounded-full text-xs font-black transition-all border ${filterCategory === cat.name ? 'bg-orange-600 text-white shadow-xl' : 'bg-white text-gray-500 border-gray-100'}`}>{cat.name}</button>
              ))}
              <button onClick={() => setIsCatManagerOpen(true)} className="p-2.5 bg-gray-100 text-gray-400 rounded-full hover:bg-orange-600 hover:text-white transition-all"><Settings2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {recipes.map(recipe => (
                <div key={recipe.id} className={`group bg-white rounded-[2rem] overflow-hidden shadow-sm border transition-all relative ${selectedRecipeIds.has(recipe.id!) ? 'border-orange-500 ring-4 ring-orange-100' : 'border-orange-50 hover:shadow-xl'}`}>
                  <div className="aspect-square bg-orange-50 overflow-hidden relative">
                    {recipe.photo ? (
                      <div className="w-full h-full relative cursor-zoom-in" onClick={() => setZoomedImage(recipe.photo!)}><img src={recipe.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /></div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-orange-200" onClick={() => setSelectedRecipe(recipe)}><Utensils className="w-8 h-8" /></div>
                    )}
                    {!isBatchMode && (
                      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                        <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === recipe.id ? null : recipe.id!); }} className="p-2.5 bg-white/80 backdrop-blur-md text-gray-500 rounded-xl hover:bg-black hover:text-white shadow-lg transition-all"><MoreHorizontal className="w-4 h-4" /></button>
                        {activeMenuId === recipe.id && (
                          <div className="absolute right-0 top-12 w-40 bg-white rounded-2xl shadow-2xl border border-gray-100 py-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                             <button onClick={(e) => { e.stopPropagation(); setEditingRecipe(recipe); setView('add'); setActiveMenuId(null); }} className="w-full px-5 py-2.5 flex items-center gap-3 text-xs font-bold text-gray-600 hover:bg-orange-50 transition-all"><Edit2 className="w-4 h-4" /> 编辑菜谱</button>
                             <button onClick={(e) => { e.stopPropagation(); if(confirm('确定删除吗？')) db.recipes.delete(recipe.id!); }} className="w-full px-5 py-2.5 flex items-center gap-3 text-xs font-bold text-red-400 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /> 彻底删除</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-4 cursor-pointer" onClick={() => isBatchMode ? (()=>{const next = new Set(selectedRecipeIds); if(next.has(recipe.id!)) next.delete(recipe.id!); else next.add(recipe.id!); setSelectedRecipeIds(next);})() : setSelectedRecipe(recipe)}><h3 className="text-sm font-black truncate">{recipe.name}</h3><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{recipe.category}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 升级后的“添加至计划”弹窗 - 支持日期选择 */}
      {isPlanAddOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
           <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 shadow-2xl animate-in zoom-in-95 duration-300 border border-orange-50">
              <div className="flex items-center justify-between mb-10">
                <h3 className="font-black text-3xl font-serif text-gray-800">添加至计划</h3>
                <button onClick={() => setIsPlanAddOpen(false)} className="p-3 hover:bg-gray-100 rounded-full transition-colors"><X className="w-7 h-7 text-gray-400" /></button>
              </div>
              <div className="space-y-8">
                <div>
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 block px-1">日期选择</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
                    <input 
                      type="date" 
                      value={planDate} 
                      onChange={e => setPlanDate(e.target.value)}
                      className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-gray-50 border-none outline-none focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all font-bold text-gray-700" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 block px-1">用餐类型</label>
                  <div className="grid grid-cols-4 gap-3">
                    {MEAL_TYPES.map(m => (
                      <button 
                        key={m} 
                        onClick={() => setPlanMeal(m)} 
                        className={`py-4 rounded-2xl text-xs font-black border transition-all ${planMeal === m ? 'bg-orange-600 text-white border-orange-600 shadow-xl shadow-orange-100' : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                   <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 block px-1">搜索菜库或直接输入</label>
                   <div className="relative">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                      <input 
                        id="planRecipeInput" 
                        list="recipeSuggestions" 
                        placeholder="输入菜名..." 
                        className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-gray-50 border-none outline-none focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all font-bold text-gray-700" 
                      />
                      <datalist id="recipeSuggestions">
                        {rawRecipes?.map(r => <option key={r.id} value={r.name} />)}
                      </datalist>
                   </div>
                </div>
                <button 
                  onClick={async () => {
                    const input = document.getElementById('planRecipeInput') as HTMLInputElement;
                    const recipeName = input.value;
                    if(!recipeName || !selectedPlanGroup) return;
                    const recipeMatch = rawRecipes?.find(r => r.name === recipeName);
                    await db.cookingPlans.add({
                      groupId: selectedPlanGroup.id!,
                      recipeId: recipeMatch?.id || -1,
                      recipeName: recipeName,
                      date: planDate,
                      mealType: planMeal
                    });
                    setIsPlanAddOpen(false);
                  }} 
                  className="w-full py-5 bg-black text-white rounded-[2rem] font-black text-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-gray-200 active:scale-95"
                >
                  <Check className="w-6 h-6" /> 确认添加
                </button>
              </div>
           </div>
        </div>
      )}

      {selectedRecipe && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6 bg-black/40 backdrop-blur-xl">
           <div className="relative bg-white w-full max-w-5xl h-full sm:h-auto sm:max-h-full sm:rounded-[4rem] overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-bottom-12 duration-700 custom-scrollbar">
              {isCookingMode && <div className="sticky top-0 z-30 w-full h-2 bg-gray-100"><div className="h-full bg-orange-500 transition-all duration-500 ease-out" style={{ width: `${cookingProgress}%` }}></div></div>}
              <div className="sticky top-0 bg-white/80 backdrop-blur-md p-8 border-b flex justify-between items-center z-20">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><ChefHat className="w-6 h-6" /></div>
                    <div><h2 className="text-3xl font-black font-serif">{selectedRecipe.name}</h2>{isCookingMode && <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">进度: {cookingProgress}%</span>}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setIsCookingMode(!isCookingMode); setCompletedSteps(new Set()); }} className={`px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 transition-all ${isCookingMode ? 'bg-orange-600 text-white' : 'bg-black text-white hover:bg-orange-600'}`}>{isCookingMode ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}{isCookingMode ? '退出烹饪' : '开始烹饪'}</button>
                    {!isCookingMode && <button onClick={() => addRecipeToPurchase(selectedRecipe)} className="p-4 bg-green-50 text-green-600 rounded-2xl hover:bg-green-600 hover:text-white transition-all"><ShoppingCart className="w-6 h-6" /></button>}
                    <button onClick={() => { setSelectedRecipe(null); setIsCookingMode(false); setCompletedSteps(new Set()); }} className="p-4 hover:bg-gray-50 rounded-2xl transition-all"><X className="w-6 h-6 text-gray-400" /></button>
                  </div>
              </div>
              <div className="p-8 md:p-16 space-y-16">
                 {!isCookingMode && selectedRecipe.photo && (<div className="aspect-[21/9] rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white cursor-zoom-in" onClick={() => setZoomedImage(selectedRecipe.photo!)}><img src={selectedRecipe.photo} className="w-full h-full object-cover" /></div>)}
                 <div className={`grid ${isCookingMode ? 'grid-cols-1' : 'md:grid-cols-2'} gap-20`}>
                    {!isCookingMode && (
                      <div className="space-y-8">
                        <h4 className="text-xs font-black text-orange-600 uppercase tracking-[0.2em] flex items-center gap-3"><ListPlus className="w-5 h-5" /> 食材配比</h4>
                        <div className="space-y-4">
                          {selectedRecipe.ingredients.map((ing, i) => (<div key={i} className="flex items-center gap-5 group"><div className="w-2 h-2 rounded-full bg-orange-300"></div><span className="text-lg font-bold text-gray-700">{ing}</span></div>))}
                        </div>
                        {selectedRecipe.notes && (
                           <div className="mt-8 p-6 bg-orange-50/50 rounded-3xl border border-orange-100 flex gap-4">
                             <Info className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                             <div>
                               <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">注意事项</p>
                               <p className="text-sm text-gray-600 leading-relaxed font-medium">{selectedRecipe.notes}</p>
                             </div>
                           </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-8">
                      <h4 className="text-xs font-black text-orange-600 uppercase tracking-[0.2em] flex items-center gap-3"><History className="w-5 h-5" /> 步骤引导</h4>
                      <div className="space-y-10">
                        {selectedRecipe.steps.map((step, i) => {
                          const timeSeconds = parseStepTime(step);
                          const isDone = completedSteps.has(i);
                          return (
                            <div key={i} onClick={() => isCookingMode && toggleCookingStep(i)} className={`flex gap-8 group transition-all ${isCookingMode ? 'cursor-pointer' : ''} ${isDone ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg font-black transition-all ${isDone ? 'bg-green-500 text-white' : 'bg-black text-white'}`}>{isDone ? <Check className="w-6 h-6" /> : i + 1}</div>
                               <div className="flex-1 space-y-4">
                                 <p className={`text-gray-600 leading-relaxed font-medium text-lg pt-1 ${isDone ? 'line-through decoration-orange-500' : ''}`}>{step}</p>
                                 {isCookingMode && timeSeconds && !isDone && (<div onClick={(e) => e.stopPropagation()} className="mt-2"><StepTimer initialSeconds={timeSeconds} /></div>)}
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="fixed bottom-24 right-8 flex flex-col gap-4 z-40">
        {view === 'home' && <button onClick={() => setView('add')} className="w-14 h-14 bg-black text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 transition-all"><Plus className="w-7 h-7" /></button>}
      </div>

      {zoomedImage && <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-[95%] max-h-[95vh] object-contain rounded-3xl animate-in zoom-in" /></div>}
    </div>
  );
};

export default App;

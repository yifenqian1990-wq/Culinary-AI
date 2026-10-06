
import { Dexie, type Table } from 'dexie';
import { Recipe, AIModelConfig, CookingRecord, CookingPlan, CookingPlanGroup, ApiKey, ModelProvider, CustomEndpoint, Category } from './types';

export interface ShoppingItem {
  id?: number;
  name: string;
  category: string;
  isChecked: 0 | 1;
  addedAt: number;
}

export interface AppState {
  id: string;
  fileHandle?: FileSystemFileHandle;
  lastSync?: number;
}

export type CulinaryDB = Dexie & {
  recipes: Table<Recipe, number>;
  categories: Table<Category, number>;
  modelConfigs: Table<AIModelConfig, string>;
  cookingRecords: Table<CookingRecord, number>;
  cookingPlanGroups: Table<CookingPlanGroup, number>;
  cookingPlans: Table<CookingPlan, number>;
  apiKeys: Table<ApiKey, number>;
  customEndpoints: Table<CustomEndpoint, number>;
  appState: Table<AppState, string>;
  shoppingItems: Table<ShoppingItem, number>;
};

const dbInstance = new Dexie('CulinaryDB');

dbInstance.version(21).stores({
  recipes: '++id, name, category, createdAt, updatedAt, isFavorite, isArchived, order',
  categories: '++id, &name, order',
  modelConfigs: 'id, name, provider, isActive',
  cookingRecords: '++id, recipeId, status, addedAt, cookedAt',
  cookingPlanGroups: '++id, name, isArchived, createdAt',
  cookingPlans: '++id, groupId, recipeId, date, mealType',
  apiKeys: '++id, label, isActive, createdAt',
  customEndpoints: '++id, name, isActive, createdAt',
  appState: 'id',
  shoppingItems: '++id, name, category, isChecked, addedAt'
});

export const db = dbInstance as CulinaryDB;

/**
 * 导出全量数据快照
 */
export async function exportAllData() {
  return {
    recipes: await db.recipes.toArray(),
    categories: await db.categories.toArray(),
    modelConfigs: await db.modelConfigs.toArray(),
    cookingRecords: await db.cookingRecords.toArray(),
    cookingPlanGroups: await db.cookingPlanGroups.toArray(),
    cookingPlans: await db.cookingPlans.toArray(),
    apiKeys: await db.apiKeys.toArray(),
    customEndpoints: await db.customEndpoints.toArray(),
    shoppingItems: await db.shoppingItems.toArray(),
    version: 1,
    exportDate: new Date().toISOString()
  };
}

/**
 * 导入全量数据快照并清空当前库
 */
export async function importAllData(data: any) {
  await db.transaction('rw', [
    db.recipes, db.categories, db.modelConfigs, db.cookingRecords, 
    db.cookingPlanGroups, db.cookingPlans, db.apiKeys, db.customEndpoints, db.shoppingItems
  ], async () => {
    await db.recipes.clear();
    await db.categories.clear();
    await db.modelConfigs.clear();
    await db.cookingRecords.clear();
    await db.cookingPlanGroups.clear();
    await db.cookingPlans.clear();
    await db.apiKeys.clear();
    await db.customEndpoints.clear();
    await db.shoppingItems.clear();

    if (data.recipes) await db.recipes.bulkAdd(data.recipes);
    if (data.categories) await db.categories.bulkAdd(data.categories);
    if (data.modelConfigs) await db.modelConfigs.bulkAdd(data.modelConfigs);
    if (data.cookingRecords) await db.cookingRecords.bulkAdd(data.cookingRecords);
    if (data.cookingPlanGroups) await db.cookingPlanGroups.bulkAdd(data.cookingPlanGroups);
    if (data.cookingPlans) await db.cookingPlans.bulkAdd(data.cookingPlans);
    if (data.apiKeys) await db.apiKeys.bulkAdd(data.apiKeys);
    if (data.customEndpoints) await db.customEndpoints.bulkAdd(data.customEndpoints);
    if (data.shoppingItems) await db.shoppingItems.bulkAdd(data.shoppingItems);
  });
}

export async function initializeDb() {
  const modelCount = await db.modelConfigs.count();
  if (modelCount === 0) {
    await db.modelConfigs.bulkAdd([
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        provider: ModelProvider.GEMINI,
        modelName: 'gemini-3-flash-preview',
        isActive: 1,
        priority: 1
      }
    ]);
  } else {
    // Ensure the active model is updated to gemini-3-flash-preview
    const currentActive = await db.modelConfigs.where('isActive').equals(1).first();
    if (currentActive && (currentActive.id !== 'gemini-3-flash-preview')) {
      await db.modelConfigs.toCollection().modify({ isActive: 0 });
      await db.modelConfigs.put({
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        provider: ModelProvider.GEMINI,
        modelName: 'gemini-3-flash-preview',
        isActive: 1,
        priority: 1
      });
    }
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    const defaultCats = ['荤菜', '素菜', '炒菜', '汤', '干锅', '凉菜', '其他'];
    await db.categories.bulkAdd(defaultCats.map((name, order) => ({ name, order })));
  }
}

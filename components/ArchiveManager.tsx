
import React from 'react';
import { db } from '../db';
import { CookingPlanGroup } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, RotateCcw, Trash2, Calendar, Utensils, Info, FolderCheck } from 'lucide-react';

export const ArchiveManager: React.FC = () => {
  const archivedGroups = useLiveQuery(() => 
    db.cookingPlanGroups.where('isArchived').equals(1).toArray()
  );

  const handleRestore = async (id: number) => {
    await db.cookingPlanGroups.update(id, { isArchived: 0 });
  };

  const handleDelete = async (id: number) => {
    if (confirm('确定永久删除此计划名称及其所有关联菜品吗？此操作无法撤销。')) {
      await db.transaction('rw', [db.cookingPlanGroups, db.cookingPlans], async () => {
        await db.cookingPlanGroups.delete(id);
        await db.cookingPlans.where('groupId').equals(id).delete();
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-black font-serif text-gray-800">烹饪计划归档</h2>
        <p className="text-gray-400 text-sm font-medium">查看并管理已完成或已归档的烹饪项目名称。</p>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
          <div className="flex items-center gap-3">
            <FolderCheck className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-700">归档计划库 (Archived Plans)</h3>
          </div>
          <span className="bg-gray-200 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">
            {archivedGroups?.length || 0} 项
          </span>
        </div>

        <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
          {archivedGroups?.map((group) => (
            <div 
              key={group.id} 
              className="group bg-gray-50/30 p-5 rounded-2xl flex items-center justify-between border border-transparent hover:border-orange-100 hover:bg-white transition-all"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-300 group-hover:text-blue-500 transition-colors">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-gray-800 tracking-tight">{group.name}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">创建于 {new Date(group.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => handleRestore(group.id!)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-xl text-[10px] font-black shadow-sm border border-blue-50 hover:bg-blue-600 hover:text-white transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 恢复计划
                </button>
                <button 
                  onClick={() => handleDelete(group.id!)}
                  className="p-2 text-gray-300 hover:text-red-500 transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {(!archivedGroups || archivedGroups.length === 0) && (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto text-gray-200">
                <FolderCheck className="w-8 h-8" />
              </div>
              <p className="text-gray-300 text-sm font-bold italic tracking-wide">
                暂无归档计划名称
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-blue-50/30 border-t border-blue-100 flex items-start gap-4">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed font-medium">
            归档计划名称会将其从“烹饪日历”视图中隐藏。归档通常用于整理已结束的大型聚餐或过去周期的日常安排。
          </p>
        </div>
      </div>
    </div>
  );
};

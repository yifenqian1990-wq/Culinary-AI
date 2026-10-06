
import React, { useState } from 'react';
import { db } from '../db';
import { ApiKey } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Key, Eye, EyeOff, Plus, Trash2, Check, Globe, ShieldCheck 
} from 'lucide-react';

export const KeyManager: React.FC = () => {
  const [showKey, setShowKey] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showCurrentKey, setShowCurrentKey] = useState(false);

  const keys = useLiveQuery(() => db.apiKeys.toArray());
  const activeKey = keys?.find(k => k.isActive === 1);

  const handleAddKey = async () => {
    if (!newLabel.trim() || !newKey.trim()) return;
    const isFirst = (keys?.length || 0) === 0;
    
    await db.apiKeys.add({
      label: newLabel,
      key: newKey,
      isActive: isFirst ? 1 : 0,
      createdAt: Date.now(),
      status: 'unknown'
    });
    
    setNewLabel('');
    setNewKey('');
  };

  const handleSetPrimary = async (id: number) => {
    await db.apiKeys.toCollection().modify({ isActive: 0 });
    await db.apiKeys.update(id, { isActive: 1 });
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('确定删除此密钥吗？')) {
      await db.apiKeys.delete(id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-black font-serif text-gray-800">Gemini API 设置</h2>
        <p className="text-gray-400 text-sm font-medium">配置 Google Gemini 的核心参数。Keys 仅存储在本地。</p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-gray-500 ml-1">当前 API Key</label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Key className="w-5 h-5" />
          </div>
          <input 
            type={showCurrentKey ? "text" : "password"} 
            readOnly 
            value={activeKey?.key || "未配置活跃密钥"} 
            className="w-full pl-12 pr-12 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all"
          />
          <button 
            onClick={() => setShowCurrentKey(!showCurrentKey)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          >
            {showCurrentKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <a 
          href="https://aistudio.google.com/app/apikey" 
          target="_blank" 
          className="text-blue-500 text-xs font-bold hover:underline flex items-center gap-1 ml-1"
        >
          获取 API Key <Globe className="w-3 h-3" />
        </a>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-700">密钥管理器 (Key Vault)</h3>
          </div>
          <span className="bg-gray-200 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">{keys?.length || 0}</span>
        </div>

        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
          {keys?.map((item) => (
            <div 
              key={item.id} 
              onClick={() => handleSetPrimary(item.id!)}
              className={`group relative p-5 rounded-2xl border-2 transition-all cursor-pointer ${item.isActive === 1 ? 'border-blue-100 bg-blue-50/30' : 'border-gray-50 bg-white hover:border-gray-100 hover:bg-gray-50/50'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-base font-black ${item.isActive === 1 ? 'text-blue-600' : 'text-gray-700'}`}>{item.label}</span>
                  {item.isActive === 1 && (
                    <span className="flex items-center gap-1 bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
                      <Check className="w-3 h-3" /> 使用中
                    </span>
                  )}
                </div>
                <button 
                  onClick={(e) => handleDelete(e, item.id!)}
                  className="p-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 px-3 py-1.5 rounded-lg font-mono text-[10px] text-gray-400 flex items-center gap-2">
                  {showKey === item.id ? item.key : `${item.key.substring(0, 8)}...${item.key.substring(item.key.length - 4)}`}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowKey(showKey === item.id ? null : item.id!); }}
                    className="hover:text-gray-600"
                  >
                    {showKey === item.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <span className="text-[10px] text-gray-300 font-bold">
                  {item.lastUsed ? new Date(item.lastUsed).toLocaleDateString() : '尚未激活'}
                </span>
              </div>
            </div>
          ))}

          {(!keys || keys.length === 0) && (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                <Key className="w-6 h-6 text-gray-200" />
              </div>
              <p className="text-gray-300 text-sm font-bold">目前还没有存储的密钥</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-3">
          <input 
            type="text" 
            placeholder="标签 (例如: 工作账号)" 
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
          <div className="relative flex-[2]">
            <input 
              type="text" 
              placeholder="API Key (AIzaSy...)" 
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <button 
            onClick={handleAddKey}
            disabled={!newLabel || !newKey}
            className="px-6 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-black transition flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> 添加
          </button>
        </div>
      </div>

      <div className="p-6 bg-orange-50/50 rounded-3xl border border-orange-100 flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-orange-500 flex-shrink-0" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-orange-900">安全与隐私</h4>
          <p className="text-xs text-orange-700 leading-relaxed">
            您的 API 密钥存储在浏览器的 IndexedDB 中，不会被上传到任何服务器。系统将优先尝试使用您在上方激活的自定义密钥。
          </p>
        </div>
      </div>
    </div>
  );
};

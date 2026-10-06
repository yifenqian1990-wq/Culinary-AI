
import React, { useState } from 'react';
import { db } from '../db';
import { CustomEndpoint } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Server, Plus, Trash2, Edit2, CheckCircle2, Globe, Link2, Shield, X, Save
} from 'lucide-react';

export const CustomEndpointManager: React.FC = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const endpoints = useLiveQuery(() => db.customEndpoints.toArray());

  const handleSave = async () => {
    if (!name || !modelId || !baseUrl) return;
    
    const data: Partial<CustomEndpoint> = {
      name,
      modelId,
      baseUrl,
      apiKey,
      createdAt: Date.now(),
      isActive: 0
    };

    if (editingId) {
      await db.customEndpoints.update(editingId, data);
    } else {
      await db.customEndpoints.add(data as CustomEndpoint);
    }

    resetForm();
  };

  const resetForm = () => {
    setName('');
    setModelId('');
    setBaseUrl('');
    setApiKey('');
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (ep: CustomEndpoint) => {
    setName(ep.name);
    setModelId(ep.modelId);
    setBaseUrl(ep.baseUrl);
    setApiKey(ep.apiKey);
    setEditingId(ep.id!);
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('确定删除此接口吗？')) {
      await db.customEndpoints.delete(id);
    }
  };

  const toggleActive = async (id: number) => {
    const ep = await db.customEndpoints.get(id);
    if (!ep) return;
    
    if (ep.isActive === 1) {
      await db.customEndpoints.update(id, { isActive: 0 });
    } else {
      await db.customEndpoints.toCollection().modify({ isActive: 0 });
      await db.customEndpoints.update(id, { isActive: 1 });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-black font-serif text-gray-800">模型服务商与自定义接口</h2>
        <p className="text-gray-400 text-sm font-medium">配置各家 API 服务商，或添加您自己的 OpenAI 兼容接口。</p>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-700">自定义 API 接口管理器</h3>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {isAdding && (
          <div className="p-8 bg-blue-50/30 border-b border-blue-100 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input 
                placeholder="显示名称 (如: Llama 3)" 
                value={name} onChange={e => setName(e.target.value)}
                className="px-5 py-3 rounded-xl border border-blue-100 outline-none focus:ring-2 focus:ring-blue-200 font-bold"
              />
              <input 
                placeholder="模型 ID (如: llama3-70b)" 
                value={modelId} onChange={e => setModelId(e.target.value)}
                className="px-5 py-3 rounded-xl border border-blue-100 outline-none focus:ring-2 focus:ring-blue-200 font-mono text-sm"
              />
            </div>
            <input 
              placeholder="Base URL (如: http://localhost:11434)" 
              value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              className="w-full px-5 py-3 rounded-xl border border-blue-100 outline-none focus:ring-2 focus:ring-blue-200 font-mono text-sm mb-4"
            />
            <input 
              type="password"
              placeholder="API Key (留空若本地无需验证)" 
              value={apiKey} onChange={e => setApiKey(e.target.value)}
              className="w-full px-5 py-3 rounded-xl border border-blue-100 outline-none focus:ring-2 focus:ring-blue-200 font-mono text-sm mb-6"
            />
            <div className="flex justify-end gap-3">
              <button onClick={resetForm} className="px-6 py-2.5 rounded-xl font-bold text-gray-400 hover:bg-white transition-all">取消</button>
              <button onClick={handleSave} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
                <Save className="w-4 h-4" /> 保存
              </button>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          {endpoints?.map(ep => (
            <div 
              key={ep.id} 
              className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${ep.isActive === 1 ? 'border-blue-100 bg-blue-50/20' : 'border-gray-50 bg-white'}`}
            >
              <div className="flex items-center gap-5 flex-1 cursor-pointer" onClick={() => toggleActive(ep.id!)}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${ep.isActive === 1 ? 'bg-blue-500 text-white shadow-lg' : 'bg-gray-50 text-gray-300'}`}>
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h4 className="font-black text-gray-800">{ep.name}</h4>
                    {ep.isActive === 1 && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">{ep.modelId}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono mt-1">{ep.baseUrl}</p>
                </div>
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => startEdit(ep)} className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(ep.id!)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}

          {(!endpoints || endpoints.length === 0) && (
            <div className="py-16 text-center text-gray-300 italic text-sm">暂无自定义接口</div>
          )}
        </div>

        <div className="p-6 bg-blue-50/20 border-t border-blue-50 flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-400 mt-0.5" />
          <p className="text-[10px] text-blue-600/70 font-medium leading-relaxed">
            启用自定义接口后，系统将使用 OpenAI API 协议向您指定的端点发送请求。对于本地服务（如 Ollama），请确保接口已允许跨域访问。
          </p>
        </div>
      </div>
    </div>
  );
};

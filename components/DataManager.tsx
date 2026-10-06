
import React, { useState, useEffect, useRef } from 'react';
import { db, exportAllData, importAllData } from '../db';
import { Download, Upload, Database, Info, CheckCircle, Loader2, FolderOpen, AlertCircle, RefreshCw, XCircle, FileJson, Share2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export const DataManager: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const importFileRef = useRef<HTMLInputElement>(null);
  
  const activeAppState = useLiveQuery(() => db.appState.get('main'));

  // 检查权限状态
  useEffect(() => {
    const check = async () => {
      if (activeAppState?.fileHandle) {
        const status = await activeAppState.fileHandle.queryPermission({ mode: 'readwrite' });
        setPermissionStatus(status);
      }
    };
    check();
  }, [activeAppState]);

  // 手动导出功能
  const handleManualExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CulinaryAI_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  // 手动导入功能
  const handleManualImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('导入备份将永久覆盖当前应用内的所有本地数据。建议导入前先导出当前数据作为备份。是否确定继续？')) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 基础验证，确保包含 recipes
      if (!data.recipes || !Array.isArray(data.recipes)) {
        throw new Error('无效的备份文件格式');
      }

      await importAllData(data);
      alert('数据恢复成功！应用将刷新以加载新内容。');
      window.location.reload();
    } catch (error: any) {
      console.error('Import failed:', error);
      alert('导入失败: ' + (error.message || '文件解析错误'));
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleConnectFile = async () => {
    try {
      // @ts-ignore
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON Database File', accept: { 'application/json': ['.json'] } }],
        multiple: false
      });

      if (!handle) return;

      // 请求读写权限
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        alert('需要读写权限才能开启实时同步');
        return;
      }

      setIsImporting(true);
      const file = await handle.getFile();
      const text = await file.text();
      
      if (text.trim()) {
        const data = JSON.parse(text);
        if (confirm('连接新文件将清除当前应用内的所有本地数据并同步文件内容，是否继续？')) {
          await importAllData(data);
        } else {
          setIsImporting(false);
          return;
        }
      } else {
        // 如果是空文件，则初始化当前数据到文件
        const currentData = await exportAllData();
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(currentData, null, 2));
        await writable.close();
      }

      await db.appState.put({ id: 'main', fileHandle: handle, lastSync: Date.now() });
      setPermissionStatus('granted');
      alert('实时同步已成功建立！');
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('断开连接后，应用将切回纯本地存储模式，不再更新该文件。确定吗？')) {
      await db.appState.delete('main');
      setPermissionStatus('prompt');
    }
  };

  const handleReauthorize = async () => {
    if (activeAppState?.fileHandle) {
      const status = await activeAppState.fileHandle.requestPermission({ mode: 'readwrite' });
      setPermissionStatus(status);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="space-y-2">
        <h2 className="text-3xl font-black font-serif text-gray-800">数据存储与备份</h2>
        <p className="text-gray-400 text-sm font-medium">管理您的本地数据库文件和实时同步设置。</p>
      </div>

      {/* Manual Backup Section */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Share2 className="w-5 h-5 text-gray-400" />
          <h3 className="font-bold text-gray-700">手动备份与恢复</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={handleManualExport}
            disabled={isExporting}
            className="flex items-center justify-between p-6 bg-orange-50/50 rounded-2xl border border-orange-100 hover:bg-orange-100 transition-all group"
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-black text-orange-900">导出数据快照</span>
              <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">JSON 格式备份</span>
            </div>
            <div className="p-3 bg-white rounded-xl shadow-sm text-orange-600 group-hover:scale-110 transition-all">
              {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </div>
          </button>

          <button 
            onClick={() => importFileRef.current?.click()}
            disabled={isImporting}
            className="flex items-center justify-between p-6 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-all group"
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-black text-gray-800">从备份恢复</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">选择 .json 文件</span>
            </div>
            <div className="p-3 bg-white rounded-xl shadow-sm text-gray-400 group-hover:scale-110 transition-all">
              {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </div>
            <input 
              ref={importFileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleManualImport}
              className="hidden"
            />
          </button>
        </div>
      </div>

      {/* Database Status Card */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-700">外部文件同步 (File System API)</h3>
          </div>
          {activeAppState?.fileHandle && (
            <button onClick={handleDisconnect} className="text-xs font-bold text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors">
              <XCircle className="w-3 h-3" /> 断开连接
            </button>
          )}
        </div>

        {!activeAppState?.fileHandle ? (
          <div 
            onClick={handleConnectFile}
            className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[1.5rem] p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-orange-50/50 hover:border-orange-200 transition-all group"
          >
            <div className="bg-white p-4 rounded-2xl shadow-sm text-gray-300 group-hover:text-orange-500 group-hover:scale-110 transition-all mb-4">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div className="text-gray-800 font-bold text-lg">开启实时双向同步</div>
            <p className="text-gray-400 text-sm mt-2 text-center max-w-sm">
              选择一个本地 JSON 文件。开启后，应用内的任何修改都将自动写回此文件，实现真正的无感持久化。
            </p>
          </div>
        ) : (
          <div className={`rounded-[1.5rem] p-6 flex items-center justify-between border transition-all ${permissionStatus === 'granted' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl shadow-sm ${permissionStatus === 'granted' ? 'bg-white text-green-500' : 'bg-white text-red-500'}`}>
                <FileJson className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold flex items-center gap-2">
                  {activeAppState.fileHandle.name}
                  {permissionStatus === 'granted' ? <CheckCircle className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                </div>
                <div className="text-xs opacity-60 font-mono">
                  {permissionStatus === 'granted' ? `同步中 (最后同步: ${activeAppState.lastSync ? new Date(activeAppState.lastSync).toLocaleTimeString() : '刚刚'})` : '连接已断开，由于浏览器安全限制，需要重新授权'}
                </div>
              </div>
            </div>
            
            {permissionStatus !== 'granted' ? (
              <button 
                onClick={handleReauthorize}
                className="bg-red-500 text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-red-600 shadow-lg shadow-red-100 transition-all"
              >
                <RefreshCw className="w-3 h-3" /> 点击重新连接
              </button>
            ) : (
              <div className="bg-green-500/10 text-green-600 px-4 py-1.5 rounded-full text-xs font-black border border-green-200">
                读写正常
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-start gap-3 text-gray-400">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed font-medium">
            开启“外部文件同步”后，应用内的所有修改（包括密钥和菜谱）都会自动写回您选择的文件中。每次启动应用，若权限正常，也会自动从该文件拉取最新状态。
          </p>
        </div>
      </div>
    </div>
  );
};

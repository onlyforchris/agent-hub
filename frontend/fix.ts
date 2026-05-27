import * as fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
const index = content.indexOf('currentStep === 5');
console.log("Index 5:", index);
if (index > 0) {
    const start = content.lastIndexOf('<div className="font-bold text-sm text-slate-800">', index);
    console.log("Start:", start);
    if (start > 0) {
        const replaceStr = `异常数据聚类降维</div>
                                   <div className="text-[10px] font-mono text-slate-500 mt-0.5 bg-slate-200 px-1.5 rounded inline-block">Skill ID: err-cluster-02</div>
                               </div>
                           </div>
                           <ToggleRight className="w-8 h-8 text-slate-300" />
                       </div>
                    </div>
                 </div>
              </div>
          )}

          {currentStep === 4 && (
             <div className="w-full max-w-2xl mx-auto py-10 px-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                   <h4 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-rose-600" /> 安全与数据隔离</h4>
                   <div className="space-y-6">
                      <div>
                         <label className="block text-xs font-bold text-slate-700 mb-2">数据权限沙箱 (Data Sandbox)</label>
                         <select className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800">
                             <option>严格隔离 (仅同组机构业务)</option>
                             <option>全局只读 (仅查不改)</option>
                         </select>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-700 mb-2">敏感字段脱敏策略</label>
                         <div className="grid grid-[auto_1fr] items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                            <input type="checkbox" defaultChecked className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer" />
                            <div className="text-sm font-medium text-slate-700">自动对 PII 进行掩码输出</div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {currentStep === 5 && (`;
        content = content.substring(0, start + '<div className="font-bold text-sm text-slate-800">'.length) + replaceStr + content.substring(index + 'currentStep === 5 && ('.length);
        fs.writeFileSync('src/App.tsx', content);
        console.log("Replaced!");
    }
}

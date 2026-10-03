import {esc, btn, field, input, select, groupTitle, help} from './common.js';
import {inspectLoras, editLoras, activeLoraWorkflow} from '../core/comfy-loras.js';
import {COMFY_PARAM_KEYS} from '../core/image-engines.js';

/** An isolated editor draft: closing discards it; only Save writes to the backend. */
export function editComfyLoras(ctx, onSaved = () => {}, {draft = false} = {}) {
  const {api} = ctx, c = api.getState().draw.comfy;
  const working = draft ? api.getComfyDraft() : null;
  const initial = working ? working.value : c.workflows.find(p => p.id === c.activeWorkflow);
  let workflow = initial.workflow || api.drawCatalog.comfyWorkflow, disabled = [...initial.disabledLoras];
  const sourceWorkflow = initial.sourceWorkflow || (working ? working.base.workflow || api.drawCatalog.comfyWorkflow : workflow);
  let name = initial.id === 'default' ? '我的 LoRA 方案' : initial.name, transport = c.loraTransport;
  let names = [], listMessage = '', listDetail = '', loading = false, request = 0, resetArmed = false;
  const controller = new AbortController(), listId = 'comfy-loras-' + crypto.randomUUID();
  const d = ctx.dialog('LoRA', '');
  d.body.dataset.engine = 'comfy';
  const q = selector => d.body.querySelector(selector);
  const attribute = `list="${listId}" autocomplete="off" spellcheck="false" placeholder="文件名.safetensors（可含子目录）"`;
  const number = (key, value, attrs = '') => input(key, value, 'number', `min="-100" max="100" step="0.05" ${attrs}`);
  function updateList() {
    if (!d.live) return;
    q('datalist').innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
    q('[data-lora-list-status]').innerHTML = esc(listMessage) + (listDetail ? help(listDetail) : '');
    q('[data-action=lora-read]').disabled = loading;
  }
  function render() {
    const info = inspectLoras(workflow);
    d.body.innerHTML = `${draft ? '' : field('方案名称', input('lora-plan-name', name, 'text', 'maxlength="60"'))}
      ${groupTitle('LoRA 文件', help('读取 ComfyUI 已安装的文件名，也可以手动填写。调整后点「应用」带回绘画草稿，再试画或保存方案；关闭本面板会放弃面板里未应用的修改。已经排队的图不受影响。'))}
      <div class="group pad">
        ${btn('lora-read', '刷新 LoRA 列表')}
        <span class="comfy-note" data-lora-list-status role="status"></span>
        <details class="comfy-advanced"><summary>读取设置</summary>${field('列表读取方式', select('lora-transport', transport, [['tavern', '经酒馆代理'], ['direct', '浏览器直连']]), '酒馆代理需要开启 enableCorsProxy；直连需要 ComfyUI 允许跨域，地址必须是当前设备能访问的地址。地址在引擎页配置。')}</details>
        <datalist id="${listId}"></datalist>
      </div>
      ${groupTitle('这套方案里的 LoRA')}
      ${info.error ? `<p class="hint error-copy">${esc(info.error)}</p>` : ''}
      ${info.nodes.length ? info.nodes.map(row => `<div class="group pad" data-lora-id="${esc(row.id)}">
        <div class="setting-row"><span class="comfy-lora-name">${esc(row.name || 'LoRA')}${help(`节点 #${row.id}。关闭后出图会跳过这一条，文件名和强度保留。${row.modelOnly ? '这条只作用于模型。' : ''}`)}</span><input type="checkbox" class="switch" data-lora-enabled aria-label="启用 LoRA ${esc(row.id)}" ${disabled.includes(row.id) ? '' : 'checked'} ${row.reason ? 'disabled' : ''}></div>
        ${row.reason ? `<p class="hint error-copy">${esc(row.reason)}</p><p class="hint">此节点原样保留。</p>` : `
        ${field('LoRA 文件', input('lora-file', row.name, 'text', attribute))}
        <div class="comfy-strengths">${field('模型强度', number('lora-model-strength', row.strength_model))}
        ${!row.modelOnly ? field('文字强度', number('lora-clip-strength', row.strength_clip), 'CLIP 强度：LoRA 对文字理解部分的影响。') : ''}</div>
        ${btn('lora-remove', '移除这一条', 'danger', `data-id="${esc(row.id)}"`)}`}
      </div>`).join('') : `<div class="comfy-note">还没有 LoRA ${help('这里只编辑原生 LoRA 节点，自定义节点会原样保留。')}</div>`}
      ${groupTitle('添加 LoRA')}
      ${info.sources.length ? `<div class="group pad">
        ${field('接入位置', select('lora-source', info.sources.length === 1 ? info.sources[0].id : '', [['', '请选择接在哪个节点后面'], ...info.sources.map(s => [s.id, s.name + (s.modelOnly ? '（只作用于模型）' : '')])]), '影响所选位置后面相连的模型和文字分支。已有 LoRA 时，可选最后一条继续叠加。其他节点保留。')}
        ${field('LoRA 文件', input('lora-new-file', '', 'text', attribute))}
        <div class="comfy-strengths">${field('模型强度', number('lora-new-model', 1))}
        ${field('文字强度', number('lora-new-clip', 1), '只作用于模型的位置不使用 CLIP 强度。LoRA 必须与基础模型兼容，并先安装在 ComfyUI。')}</div>
        ${btn('lora-add', '添加到这套方案')}
      </div>` : '<p class="hint">没有能可靠识别的接入位置。请在 ComfyUI 放入原生 LoRA 节点并重新导入；这里会保留其他节点。</p>'}
      <div class="actions">${draft ? btn('lora-apply', '应用到绘画', 'primary') : `${initial.id === 'default' ? '' : btn('lora-save', '保存当前方案', 'primary')}${btn('lora-save-as', '另存为方案', initial.id === 'default' ? 'primary' : 'secondary')}`}</div>
      <div class="actions">${btn('lora-reset', resetArmed ? '确认恢复导入时的工作流' : '恢复导入时的工作流')}${btn('lora-cancel', '取消')}</div>
      <div class="comfy-note">${help('恢复只重置工作流和 LoRA。应用后回到绘画页，保存方案才会写入已保存的配置。')}</div>`;
    updateList();
  }
  // Preserve incomplete edits during network replies: refreshing the catalogue only changes the datalist/status.
  function capture(skip = '') {
    const updates = [], off = new Set(disabled);
    for (const row of d.body.querySelectorAll('[data-lora-id]')) {
      const id = row.dataset.loraId, file = row.querySelector('[data-field=lora-file]');
      if (!file || id === skip) continue;
      const patch = {id, lora_name: file.value, strength_model: row.querySelector('[data-field=lora-model-strength]').value};
      const clip = row.querySelector('[data-field=lora-clip-strength]');
      if (clip) patch.strength_clip = clip.value;
      updates.push(patch);
      if (row.querySelector('[data-lora-enabled]').checked) off.delete(id); else off.add(id);
    }
    const edited = editLoras(workflow, {updates});
    workflow = edited; disabled = [...off]; name = q('[data-field=lora-plan-name]')?.value ?? name;
  }
  async function readList() {
    const token = ++request;
    transport = q('[data-field=lora-transport]').value;
    api.saveDraw({comfy: {loraTransport: transport}});
    loading = true; names = []; listMessage = '正在读取…'; listDetail = ''; updateList();
    try {
      const result = await api.comfyLoras({transport, signal: controller.signal});
      if (!d.live || token !== request) return;
      names = result; listMessage = names.length ? `${names.length} 个可选` : '还没有 LoRA 文件';
    } catch (error) { if (d.live && token === request) { listMessage = '读取失败，可手填文件名'; listDetail = error.message; } }
    finally { if (d.live && token === request) { loading = false; updateList(); } }
  }
  function save(copy) {
    capture();
    activeLoraWorkflow(workflow, disabled);
    const row = api.saveComfyWorkflow({...(copy ? {} : {id: initial.id, expected: initial}),
      name, workflow, sourceWorkflow, disabledLoras: disabled, params: Object.fromEntries(COMFY_PARAM_KEYS.map(k => [k, initial[k]]))});
    d.close(true); onSaved(); ctx.notify('已保存并切换到「' + row.name + '」');
  }
  async function click(event) {
    const button = event.target.closest('[data-action]');
    if (!button || !d.body.contains(button) || button.disabled) return;
    event.preventDefault();
    try {
      switch (button.dataset.action) {
        case 'lora-read': await readList(); break;
        case 'lora-add': {
          const add = {source: q('[data-field=lora-source]').value, lora_name: q('[data-field=lora-new-file]').value, strength_model: q('[data-field=lora-new-model]').value, strength_clip: q('[data-field=lora-new-clip]').value};
          capture(); workflow = editLoras(workflow, {add}); resetArmed = false; render(); break;
        }
        case 'lora-remove': capture(button.dataset.id); workflow = editLoras(workflow, {remove: button.dataset.id}); disabled = disabled.filter(id => id !== button.dataset.id); resetArmed = false; render(); break;
        case 'lora-save': save(false); break;
        case 'lora-save-as': save(true); break;
        case 'lora-apply': capture(); api.updateComfyDraft({workflow, disabledLoras: disabled}, initial); d.close(true); onSaved(); break;
        case 'lora-reset':
          if (!resetArmed) { resetArmed = true; button.textContent = '确认恢复导入时的工作流'; break; }
          name = q('[data-field=lora-plan-name]')?.value ?? name; workflow = sourceWorkflow; disabled = []; resetArmed = false; render(); break;
        case 'lora-cancel': d.close(false); break;
      }
    } catch (error) { if (d.live) ctx.notify(error.message, {error: true}); }
  }
  function change(event) {
    if (event.target.matches('[data-field=lora-transport]')) {
      request++; transport = event.target.value; names = []; loading = false; listMessage = '请重新读取列表'; listDetail = ''; updateList();
    }
  }
  d.body.addEventListener('click', click); d.body.addEventListener('change', change);
  d.onClose(() => { request++; controller.abort(); d.body.removeEventListener('click', click); d.body.removeEventListener('change', change); });
  render();
  return d;
}

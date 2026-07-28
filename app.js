/* =========================================================
   GESTOR IPTV — app.js
   Tudo roda no navegador, dados salvos em localStorage
   (e opcionalmente sincronizados com um repositório no GitHub).
========================================================= */

const DB_KEY = "iptv_manager_db_v1";

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

/* -------------------- ciclos de plano -------------------- */
const CICLOS = {
  mensal:      { label: "Mensal",      sufixo: "por mês",      dias: 30 },
  trimestral:  { label: "Trimestral",  sufixo: "por trimestre",dias: 90 },
  semestral:   { label: "Semestral",   sufixo: "por semestre", dias: 180 },
  anual:       { label: "Anual",       sufixo: "por ano",      dias: 365 },
};

/* -------------------- tipos de template de mensagem -------------------- */
const TEMPLATE_TIPOS = {
  lembrete:    { label: "Lembrete",         cls: "status-pendente" },
  atraso:      { label: "Atraso",           cls: "status-vencido" },
  bloqueio:    { label: "Aviso de bloqueio",cls: "status-bloqueado" },
  confirmacao: { label: "Confirmação",      cls: "status-pago" },
  outro:       { label: "Outro",            cls: "status-inativo" },
};

function loadDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(raw){
    try{ return JSON.parse(raw); }catch(e){ console.warn("DB corrompida, recriando", e); }
  }
  return seedDB();
}

function saveDB(opts){
  opts = opts || {};
  if(!opts.skipTimestamp) DB.updatedAt = Date.now();
  localStorage.setItem(DB_KEY, JSON.stringify(DB));
  if(!opts.skipSync) scheduleSync();
}

function seedDB(){
  const planoMensal = uid(), planoSemestral = uid();
  const fornGold = uid();
  const clienteLidiana = uid();
  const db = {
    empresa: "Minha IPTV",
    planos: [
      { id: planoMensal, nome: "Casadinha", valor: 50, ciclo: "mensal" },
      { id: planoSemestral, nome: "Computador", valor: 280, ciclo: "semestral" },
    ],
    fornecedores: [
      { id: fornGold, nome: "GoldPlay", custo: 5 },
    ],
    clientes: [
      { id: clienteLidiana, nome: "Lidiana", email: "", telefone: "5582981206412", observacao: "", ativo: true, bloqueado: false },
    ],
    servicos: [
      { id: uid(), clienteId: clienteLidiana, planoId: planoMensal, valor: 25, vencimento: addDaysStr(todayISO(),7), fornecedorId: fornGold, observacao: "" },
    ],
    pagamentos: [],
    lancamentos: [],
    templates: [
      { id: uid(), nome: "Lembrete de vencimento", tipo: "lembrete", texto: "Olá {nome}! 👋\nSeu plano {plano} vence em {vencimento}.\nValor: {valor}\n\nQualquer dúvida, estou à disposição!" },
      { id: uid(), nome: "Pagamento em atraso", tipo: "atraso", texto: "Olá {nome}, tudo bem?\nNotei que o pagamento do seu plano {plano} (venc. {vencimento}) ainda está pendente.\nValor: {valor}\n\nPode verificar para mim, por favor?" },
      { id: uid(), nome: "Aviso de bloqueio", tipo: "bloqueio", texto: "Olá {nome}, tudo bem?\nSeu plano {plano} (venc. {vencimento}) está em atraso e o pagamento ainda não foi identificado.\nValor: {valor}\n\n⚠️ Para evitar a interrupção do serviço, pedimos que regularize o pagamento o quanto antes. Caso não seja identificado até amanhã, o sinal será bloqueado por falta de pagamento.\n\nQualquer dúvida, estou à disposição!" },
      { id: uid(), nome: "Confirmação de pagamento", tipo: "confirmacao", texto: "Recebido! ✅\nSeu pagamento de {valor} foi confirmado, {nome}.\nSeu acesso segue liberado até o próximo vencimento. Obrigado pela confiança!" },
    ],
  };
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

let DB = loadDB();
migrateDB();

/* -------------------- migração de dados antigos -------------------- */
function migrateDB(){
  let changed = false;
  if(!DB.templates) DB.templates = [];
  DB.templates.forEach(t=>{
    if(!t.tipo){ t.tipo = "outro"; changed = true; }
  });
  const temBloqueio = DB.templates.some(t=>t.tipo==="bloqueio");
  if(!temBloqueio){
    DB.templates.push({
      id: uid(), nome: "Aviso de bloqueio", tipo: "bloqueio",
      texto: "Olá {nome}, tudo bem?\nSeu plano {plano} (venc. {vencimento}) está em atraso e o pagamento ainda não foi identificado.\nValor: {valor}\n\n⚠️ Para evitar a interrupção do serviço, pedimos que regularize o pagamento o quanto antes. Caso não seja identificado até amanhã, o sinal será bloqueado por falta de pagamento.\n\nQualquer dúvida, estou à disposição!"
    });
    changed = true;
  }
  if(!DB.lancamentos) DB.lancamentos = [];
  if(changed) saveDB({ skipSync:true });
}

/* -------------------- helpers de data -------------------- */
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(iso){
  if(!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtMoney(v){
  return (Number(v)||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}
function addDaysStr(iso, days){
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0,10);
}
function daysDiff(iso){
  const a = new Date(todayISO()+"T00:00:00");
  const b = new Date(iso+"T00:00:00");
  return Math.round((b-a)/86400000);
}
function monthLabel(ym){
  const [y,m] = ym.split("-");
  const names = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${names[Number(m)-1]} ${Number(m)}/${y}`;
}

/* -------------------- navegação -------------------- */
const pageTitleEl = document.getElementById("pageTitle");
const pageContentEl = document.getElementById("pageContent");
let currentPage = "pagamentos";

const PAGE_TITLES = {
  servicos: "Serviços",
  planos: "Planos",
  clientes: "Clientes",
  pagamentos: "Pagamentos",
  fornecedores: "Fornecedores",
  financeiro: "Financeiro",
  templates: "Templates de mensagem",
};

document.querySelectorAll(".nav-item[data-page]").forEach(btn=>{
  btn.addEventListener("click", ()=>{ goToPage(btn.dataset.page); });
});

document.querySelector('[data-toggle="cadastros"]').addEventListener("click", (e)=>{
  const sub = document.getElementById("cadastrosSub");
  sub.style.display = sub.style.display === "none" ? "flex" : "none";
  e.currentTarget.classList.toggle("open");
});

function goToPage(page){
  currentPage = page;
  pageTitleEl.textContent = PAGE_TITLES[page] || page;
  document.querySelectorAll(".nav-item[data-page]").forEach(b=>{
    b.classList.toggle("active", b.dataset.page === page);
  });
  render();
}

function render(){
  ensurePaymentsGenerated();
  switch(currentPage){
    case "clientes": renderClientes(); break;
    case "pagamentos": renderPagamentos(); break;
    case "planos": renderPlanos(); break;
    case "fornecedores": renderFornecedores(); break;
    case "financeiro": renderFinanceiro(); break;
    case "templates": renderTemplates(); break;
    case "servicos": renderServicos(); break;
    default: pageContentEl.innerHTML = "";
  }
}

/* =========================================================
   GERAÇÃO AUTOMÁTICA DE PAGAMENTOS (por serviço/assinatura)
========================================================= */
function ensurePaymentsGenerated(){
  let changed = false;
  DB.servicos.forEach(servico=>{
    if(!servico.vencimento) return;
    const existing = DB.pagamentos.filter(p=>p.servicoId===servico.id);
    const hasOpen = existing.some(p=>p.status!=="pago");
    if(!hasOpen){
      DB.pagamentos.push({
        id: uid(), servicoId: servico.id, valor: servico.valor,
        vencimento: servico.vencimento, status: "pendente", dataPagamento: null,
      });
      changed = true;
    }
  });
  DB.pagamentos.forEach(p=>{
    if(p.status==="pendente" && daysDiff(p.vencimento) < 0){ p.status="vencido"; changed=true; }
  });
  if(changed) saveDB();
}

function clienteById(id){ return DB.clientes.find(c=>c.id===id); }
function planoById(id){ return DB.planos.find(p=>p.id===id); }
function fornecedorById(id){ return DB.fornecedores.find(f=>f.id===id); }
function servicoById(id){ return DB.servicos.find(s=>s.id===id); }
function servicosDoCliente(clienteId){ return DB.servicos.filter(s=>s.clienteId===clienteId); }

/* =========================================================
   PÁGINA: SERVIÇOS  (lista de assinaturas/serviços por cliente)
========================================================= */
let servSearch = "";
let servStatusFilter = "todos";

function renderServicos(){
  pageContentEl.innerHTML = `
  <div class="toolbar">
    <div class="search-box"><span>🔍</span>
      <input id="servSearchInput" placeholder="Pesquisar" value="${escapeHtml(servSearch)}">
    </div>
    <div class="field-inline">
      <label style="color:var(--text-faint); font-size:12px;">Status</label>
      <select id="servStatusSelect">
        <option value="ativos" ${servStatusFilter==="ativos"?"selected":""}>Ativos</option>
        <option value="inativos" ${servStatusFilter==="inativos"?"selected":""}>Inativos</option>
        <option value="todos" ${servStatusFilter==="todos"?"selected":""}>Todos</option>
      </select>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-primary" onclick="openServicoModal()">+ Novo serviço</button>
    </div>
  </div>
  <div id="servListWrap"></div>
  `;
  document.getElementById("servSearchInput").addEventListener("input", e=>{ servSearch=e.target.value; renderServList(); });
  document.getElementById("servStatusSelect").addEventListener("change", e=>{ servStatusFilter=e.target.value; renderServList(); });
  renderServList();
}

function renderServList(){
  const wrap = document.getElementById("servListWrap");
  let list = DB.servicos.slice();

  list = list.filter(s=>{
    const c = clienteById(s.clienteId);
    if(!c) return false;
    if(servStatusFilter==="ativos" && !c.ativo) return false;
    if(servStatusFilter==="inativos" && c.ativo) return false;
    return true;
  });
  if(servSearch.trim()){
    const q = servSearch.trim().toLowerCase();
    list = list.filter(s=>{
      const c = clienteById(s.clienteId);
      const f = fornecedorById(s.fornecedorId);
      return (c&&c.nome||"").toLowerCase().includes(q) || (f&&f.nome||"").toLowerCase().includes(q);
    });
  }

  if(list.length===0){
    wrap.innerHTML = emptyPanel("🧾","Nenhum serviço encontrado","Cadastre um serviço para começar a cobrar mensalidades.");
    return;
  }

  const rows = list.map(s=>{
    const c = clienteById(s.clienteId) || {nome:"Cliente removido"};
    const plano = planoById(s.planoId);
    const forn = fornecedorById(s.fornecedorId);
    const blocked = c.bloqueado;
    return `
    <div class="serv-row">
      <div class="serv-main">
        <div class="serv-avatar">👤</div>
        <div>
          <div class="cell-name">${escapeHtml(c.nome)}
            <span class="status-pill ${c.ativo?'status-ativo':'status-inativo'}">${c.ativo?"Ativo":"Inativo"}</span>
            ${blocked?`<span class="status-pill status-bloqueado">Bloqueado</span>`:""}
          </div>
        </div>
      </div>
      <div class="serv-fields ${blocked?'blurred-field':''}">
        <div><span class="field-label">Plano:</span> ${plano?escapeHtml(plano.nome):"—"}</div>
        <div><span class="field-label">Valor:</span> ${fmtMoney(s.valor)}</div>
        <div><span class="field-label">Vencimento:</span> ${fmtDate(s.vencimento)}</div>
        <div><span class="field-label">Fornecedor:</span> ${forn?escapeHtml(forn.nome):"—"}</div>
        <div><span class="field-label">Observação:</span> ${s.observacao?escapeHtml(s.observacao):"-"}</div>
      </div>
      <div class="serv-actions">
        ${blocked
          ? `<button class="btn btn-primary" onclick="toggleBloqueio('${c.id}')">🔓 Desbloquear cliente</button>`
          : `<button class="icon-action" title="Editar" onclick="openServicoModal('${s.id}')">✏️</button>
             <button class="icon-action" title="Bloquear cliente" onclick="toggleBloqueio('${c.id}')" style="color:var(--red); border-color:var(--red-bg);">⏻</button>`
        }
      </div>
    </div>`;
  }).join("");

  wrap.innerHTML = `<div class="panel serv-list">${rows}</div>`;
}

function toggleBloqueio(clienteId){
  const c = clienteById(clienteId);
  if(!c) return;
  c.bloqueado = !c.bloqueado;
  saveDB();
  render();
}

function openServicoModal(id){
  const editing = id ? servicoById(id) : null;
  const clienteOptions = DB.clientes.map(c=>`<option value="${c.id}" ${editing&&editing.clienteId===c.id?"selected":""}>${escapeHtml(c.nome)}</option>`).join("");
  const planoOptions = DB.planos.map(p=>`<option value="${p.id}" ${editing&&editing.planoId===p.id?"selected":""}>${escapeHtml(p.nome)} (${fmtMoney(p.valor)})</option>`).join("");
  const fornOptions = DB.fornecedores.map(f=>`<option value="${f.id}" ${editing&&editing.fornecedorId===f.id?"selected":""}>${escapeHtml(f.nome)}</option>`).join("");

  openModal(`
    <button class="icon-btn modal-close" onclick="closeModal()">✕</button>
    <h2>${editing?"Editar serviço":"Novo serviço"}</h2>
    <form id="servForm">
      <div class="form-row">
        <label>Cliente</label>
        <select name="clienteId" required ${DB.clientes.length===0?"disabled":""}>
          <option value="">Selecione...</option>${clienteOptions}
        </select>
        ${DB.clientes.length===0?`<div class="hint">Cadastre um cliente primeiro em Cadastros → Clientes.</div>`:""}
      </div>
      <div class="form-row">
        <label>Plano</label>
        <select name="planoId" id="servPlanoSelect">
          <option value="">Sem plano / avulso</option>${planoOptions}
        </select>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" min="0" required value="${editing?editing.valor:""}"></div>
        <div class="form-row"><label>Vencimento</label><input name="vencimento" type="date" required value="${editing?editing.vencimento:todayISO()}"></div>
      </div>
      <div class="form-row">
        <label>Fornecedor</label>
        <select name="fornecedorId"><option value="">—</option>${fornOptions}</select>
      </div>
      <div class="form-row"><label>Observação</label><textarea name="observacao">${editing?escapeHtml(editing.observacao||""):""}</textarea></div>
      <div class="modal-actions">
        ${editing?`<button type="button" class="btn btn-danger" onclick="deleteServico('${editing.id}')">Excluir</button>`:"<span></span>"}
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editing?"Salvar":"Cadastrar"}</button>
        </div>
      </div>
    </form>
  `);

  document.getElementById("servPlanoSelect").addEventListener("change", e=>{
    const plano = planoById(e.target.value);
    if(plano) document.querySelector('#servForm [name="valor"]').value = plano.valor;
  });

  document.getElementById("servForm").addEventListener("submit", e=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if(editing){
      Object.assign(editing, fd, { valor: Number(fd.valor) });
    } else {
      DB.servicos.push({ id: uid(), clienteId: fd.clienteId, planoId: fd.planoId, valor: Number(fd.valor), vencimento: fd.vencimento, fornecedorId: fd.fornecedorId, observacao: fd.observacao });
    }
    saveDB(); closeModal(); render();
  });
}
function deleteServico(id){
  if(!confirm("Excluir este serviço e seus pagamentos?")) return;
  DB.servicos = DB.servicos.filter(s=>s.id!==id);
  DB.pagamentos = DB.pagamentos.filter(p=>p.servicoId!==id);
  saveDB(); closeModal(); render();
}

/* =========================================================
   PÁGINA: PAGAMENTOS
========================================================= */
let pagamentosTab = "pendente";
let pagSearch = "";
let pagMonth = "";

function renderPagamentos(){
  const vencidosCount = DB.pagamentos.filter(p=>p.status==="vencido").length;
  pageContentEl.innerHTML = `
  <div class="tabs">
    ${tabBtn("pendente","Pendente","🕐")}
    ${tabBtn("vencido","Vencidos","⚠️", vencidosCount)}
    ${tabBtn("pago","Pagos","✅")}
    ${tabBtn("todos","Todos","🔲")}
  </div>
  <div class="toolbar">
    <div class="search-box"><span>🔍</span>
      <input id="pagSearchInput" placeholder="Pesquisar por nome, email ou telefone" value="${escapeHtml(pagSearch)}">
    </div>
    <div class="field-inline">📅 <input type="month" id="pagMonthInput" value="${pagMonth}"></div>
    <div class="toolbar-right"><button class="btn btn-primary" onclick="openServicoModal()">+ Novo serviço</button></div>
  </div>
  <div id="pagListWrap"></div>
  `;
  document.getElementById("pagSearchInput").addEventListener("input", e=>{ pagSearch=e.target.value; renderPagList(); });
  document.getElementById("pagMonthInput").addEventListener("change", e=>{ pagMonth=e.target.value; renderPagList(); });
  renderPagList();
}

function tabBtn(key, label, icon, badge){
  const active = pagamentosTab === key ? "active" : "";
  return `<button class="tab ${active}" onclick="setPagTab('${key}')">${icon} ${label} ${badge?`<span class="badge">${badge}</span>`:""}</button>`;
}
function setPagTab(key){ pagamentosTab = key; renderPagamentos(); }

function renderPagList(){
  const wrap = document.getElementById("pagListWrap");
  let list = DB.pagamentos.slice();
  if(pagamentosTab !== "todos") list = list.filter(p=>p.status === pagamentosTab);
  if(pagSearch.trim()){
    const q = pagSearch.trim().toLowerCase();
    list = list.filter(p=>{
      const s = servicoById(p.servicoId); const c = s && clienteById(s.clienteId);
      if(!c) return false;
      return (c.nome||"").toLowerCase().includes(q) || (c.email||"").toLowerCase().includes(q) || (c.telefone||"").toLowerCase().includes(q);
    });
  }
  if(pagMonth) list = list.filter(p=> (p.vencimento||"").slice(0,7) === pagMonth);
  list.sort((a,b)=> a.vencimento.localeCompare(b.vencimento));

  if(list.length === 0){
    wrap.innerHTML = emptyPanel("📄","Nenhum pagamento encontrado","Nenhum pagamento para este filtro/pesquisa.");
    return;
  }

  const rows = list.map(p=>{
    const s = servicoById(p.servicoId);
    const c = (s && clienteById(s.clienteId)) || {nome:"Cliente removido", telefone:"", email:""};
    const plano = s && planoById(s.planoId);
    return `
    <tr>
      <td><div class="cell-name">${escapeHtml(c.nome)} ${c.bloqueado?`<span class="status-pill status-bloqueado" style="margin-left:6px;">Bloqueado</span>`:""}</div>
          <div class="cell-sub">${escapeHtml(c.telefone||c.email||"")}</div></td>
      <td>${plano ? escapeHtml(plano.nome) : "—"}</td>
      <td>${fmtMoney(p.valor)}</td>
      <td>${fmtDate(p.vencimento)}</td>
      <td>${statusPillFor(p.status)}</td>
      <td><div class="row-actions">
        ${p.status!=="pago"
          ? `<button class="btn btn-primary btn-sm" onclick="marcarPago('${p.id}')">Marcar pago</button>`
          : `<span class="cell-sub">Pago em ${fmtDate(p.dataPagamento)}</span>
             <button class="icon-action" title="Desfazer pagamento (dei baixa sem querer)" onclick="desfazerPagamento('${p.id}')">↩️</button>`
        }
        ${p.status==="vencido" ? `<button class="icon-action" title="Enviar aviso de bloqueio" onclick="sendWhats('${c.id}','bloqueio')" style="color:var(--red); border-color:var(--red-bg);">🚫</button>` : ""}
        <button class="icon-action" title="Enviar cobrança" onclick="sendWhats('${c.id}')">💬</button>
        <button class="icon-action" title="Excluir pagamento" onclick="excluirPagamento('${p.id}')" style="color:var(--red); border-color:var(--red-bg);">🗑️</button>
      </div></td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `<div class="panel"><table><thead><tr><th>Cliente</th><th>Plano</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function statusPillFor(status){
  const map = { pendente: ["status-pendente","🕐 Pendente"], vencido: ["status-vencido","⚠️ Vencido"], pago: ["status-pago","✅ Pago"] };
  const [cls, label] = map[status] || ["status-pendente", status];
  return `<span class="status-pill ${cls}">${label}</span>`;
}

function proximoVencimento(servico){
  const plano = planoById(servico.planoId);
  const dias = (plano && CICLOS[plano.ciclo] && CICLOS[plano.ciclo].dias) || 30;
  let next = addDaysStr(servico.vencimento, dias);
  // se o pagamento estava muito atrasado, avança quantos ciclos forem necessários até cair no futuro
  let guard = 0;
  while(daysDiff(next) < 0 && guard < 60){ next = addDaysStr(next, dias); guard++; }
  return next;
}

function marcarPago(pagId){
  const p = DB.pagamentos.find(x=>x.id===pagId);
  if(!p) return;
  p.status = "pago";
  p.dataPagamento = todayISO();
  const servico = servicoById(p.servicoId);
  if(servico){
    // avança o vencimento do serviço para o próximo ciclo, evitando gerar uma
    // cobrança fantasma duplicada com a mesma data (já paga) no próximo carregamento
    servico.vencimento = proximoVencimento(servico);
  }
  saveDB();
  renderPagamentos();
  if(currentPage==="financeiro") renderFinResumo();
}

function desfazerPagamento(pagId){
  const p = DB.pagamentos.find(x=>x.id===pagId);
  if(!p || p.status!=="pago") return;
  if(!confirm("Desfazer este pagamento? Ele volta para pendente/vencido, e a próxima cobrança gerada para este serviço (se houver) será removida.")) return;
  const servico = servicoById(p.servicoId);
  if(servico){
    servico.vencimento = p.vencimento; // volta a data de vencimento original do serviço
    // remove a cobrança do próximo ciclo que foi gerada automaticamente após este pagamento
    DB.pagamentos = DB.pagamentos.filter(x=> x.id===p.id || x.servicoId!==p.servicoId || x.status==="pago");
  }
  p.status = daysDiff(p.vencimento) < 0 ? "vencido" : "pendente";
  p.dataPagamento = null;
  saveDB();
  renderPagamentos();
  if(currentPage==="financeiro") renderFinResumo();
}

function excluirPagamento(pagId){
  const p = DB.pagamentos.find(x=>x.id===pagId);
  if(!p) return;
  if(!confirm("Excluir este pagamento? Se o serviço ainda estiver ativo, um novo pagamento pendente será gerado automaticamente na próxima abertura da lista.")) return;
  if(p.status==="pago"){
    const servico = servicoById(p.servicoId);
    if(servico){
      servico.vencimento = p.vencimento;
      DB.pagamentos = DB.pagamentos.filter(x=> x.id===p.id || x.servicoId!==p.servicoId || x.status==="pago");
    }
  }
  DB.pagamentos = DB.pagamentos.filter(x=>x.id!==p.id);
  saveDB();
  renderPagamentos();
  if(currentPage==="financeiro") renderFinResumo();
}

function sendWhats(clienteId, tipo){
  const c = clienteById(clienteId);
  if(!c || !c.telefone){ alert("Este cliente não tem telefone cadastrado."); return; }
  const servicos = servicosDoCliente(clienteId);
  const servico = servicos[0];
  const plano = servico && planoById(servico.planoId);
  const pagamento = DB.pagamentos.filter(p=>servicos.some(s=>s.id===p.servicoId) && p.status!=="pago").sort((a,b)=>a.vencimento.localeCompare(b.vencimento))[0];

  let tipoEscolhido = tipo;
  if(!tipoEscolhido && pagamento){
    tipoEscolhido = pagamento.status === "vencido" ? "atraso" : "lembrete";
  }
  const tpl = (tipoEscolhido && DB.templates.find(t=>t.tipo===tipoEscolhido)) || DB.templates[0];
  if(!tpl){ alert("Cadastre um template de mensagem primeiro, na aba Templates de mensagem."); return; }
  const msg = fillTemplate(tpl.texto, c, plano, pagamento || servico);
  const phone = (c.telefone||"").replace(/\D/g,"");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
}

function fillTemplate(text, c, plano, pagamento){
  return text
    .replaceAll("{nome}", c.nome || "")
    .replaceAll("{plano}", plano ? plano.nome : "")
    .replaceAll("{valor}", pagamento ? fmtMoney(pagamento.valor) : "")
    .replaceAll("{vencimento}", pagamento ? fmtDate(pagamento.vencimento) : "");
}

/* =========================================================
   PÁGINA: CLIENTES
========================================================= */
let cliSearch = "";
let cliStatusFilter = "ativos";
let cliBloqueioFilter = "todos";

function renderClientes(){
  pageContentEl.innerHTML = `
  <div class="toolbar">
    <div class="search-box"><span>🔍</span>
      <input id="cliSearchInput" placeholder="Pesquisar por nome, email ou telefone" value="${escapeHtml(cliSearch)}">
    </div>
    <div class="field-inline">
      <label style="color:var(--text-faint); font-size:12px;">Status</label>
      <select id="cliStatusSelect">
        <option value="ativos" ${cliStatusFilter==="ativos"?"selected":""}>Ativos</option>
        <option value="inativos" ${cliStatusFilter==="inativos"?"selected":""}>Inativos</option>
        <option value="todos" ${cliStatusFilter==="todos"?"selected":""}>Todos</option>
      </select>
    </div>
    <div class="field-inline">
      <label style="color:var(--text-faint); font-size:12px;">Bloqueio</label>
      <select id="cliBloqueioSelect">
        <option value="todos" ${cliBloqueioFilter==="todos"?"selected":""}>Todos</option>
        <option value="bloqueados" ${cliBloqueioFilter==="bloqueados"?"selected":""}>Bloqueados</option>
        <option value="desbloqueados" ${cliBloqueioFilter==="desbloqueados"?"selected":""}>Desbloqueados</option>
      </select>
    </div>
    <div class="toolbar-right"><button class="btn btn-primary" onclick="openClienteModal()">+ Novo cliente</button></div>
  </div>
  <div id="cliListWrap"></div>
  `;
  document.getElementById("cliSearchInput").addEventListener("input", e=>{ cliSearch=e.target.value; renderCliList(); });
  document.getElementById("cliStatusSelect").addEventListener("change", e=>{ cliStatusFilter=e.target.value; renderCliList(); });
  document.getElementById("cliBloqueioSelect").addEventListener("change", e=>{ cliBloqueioFilter=e.target.value; renderCliList(); });
  renderCliList();
}

function renderCliList(){
  const wrap = document.getElementById("cliListWrap");
  let list = DB.clientes.slice();
  if(cliStatusFilter==="ativos") list = list.filter(c=>c.ativo);
  if(cliStatusFilter==="inativos") list = list.filter(c=>!c.ativo);
  if(cliBloqueioFilter==="bloqueados") list = list.filter(c=>c.bloqueado);
  if(cliBloqueioFilter==="desbloqueados") list = list.filter(c=>!c.bloqueado);
  if(cliSearch.trim()){
    const q = cliSearch.trim().toLowerCase();
    list = list.filter(c => (c.nome||"").toLowerCase().includes(q) || (c.email||"").toLowerCase().includes(q) || (c.telefone||"").toLowerCase().includes(q));
  }
  list.sort((a,b)=>a.nome.localeCompare(b.nome));

  if(list.length===0){
    wrap.innerHTML = emptyPanel("👤","Nenhum cliente encontrado","Clique em \"Novo cliente\" para começar.");
    return;
  }

  const rows = list.map(c=>{
    const n = servicosDoCliente(c.id).length;
    const blocked = c.bloqueado;
    return `
    <div class="serv-row">
      <div class="serv-main">
        <div class="serv-avatar">👤</div>
        <div>
          <div class="cell-name">${escapeHtml(c.nome)}
            <span class="status-pill ${c.ativo?'status-ativo':'status-inativo'}">${c.ativo?"Ativo":"Inativo"}</span>
            ${blocked?`<span class="status-pill status-bloqueado">Bloqueado</span>`:""}
          </div>
        </div>
      </div>
      <div class="serv-fields ${blocked?'blurred-field':''}">
        <div><span class="field-label">Email:</span> ${c.email?escapeHtml(c.email):"Não informado"}</div>
        <div><span class="field-label">Telefone:</span> ${c.telefone?escapeHtml(c.telefone):"Não informado"}</div>
        <div><span class="field-label">Serviços:</span> ${n}</div>
        <div><span class="field-label">Observação:</span> ${c.observacao?escapeHtml(c.observacao):"Não informado"}</div>
      </div>
      <div class="serv-actions">
        ${blocked
          ? `<button class="btn btn-primary" onclick="toggleBloqueio('${c.id}')">🔓 Desbloquear cliente</button>`
          : `<button class="icon-action" title="WhatsApp" onclick="sendWhats('${c.id}')" style="color:var(--green); border-color:var(--green-bg);">💬</button>
             <button class="icon-action" title="Editar" onclick="openClienteModal('${c.id}')">✏️</button>
             <button class="icon-action" title="Bloquear cliente" onclick="toggleBloqueio('${c.id}')" style="color:var(--red); border-color:var(--red-bg);">⏻</button>`
        }
      </div>
    </div>`;
  }).join("");

  wrap.innerHTML = `<div class="panel serv-list">${rows}</div>`;
}

function openClienteModal(id){
  const editing = id ? clienteById(id) : null;
  openModal(`
    <button class="icon-btn modal-close" onclick="closeModal()">✕</button>
    <h2>${editing ? "Editar cliente" : "Novo cliente"}</h2>
    <form id="clienteForm">
      <div class="form-row"><label>Nome completo</label><input name="nome" required value="${editing?escapeHtml(editing.nome):""}"></div>
      <div class="form-grid-2">
        <div class="form-row"><label>Telefone (WhatsApp)</label><input name="telefone" placeholder="5511999999999" value="${editing?escapeHtml(editing.telefone||""):""}"></div>
        <div class="form-row"><label>Email</label><input name="email" type="email" value="${editing?escapeHtml(editing.email||""):""}"></div>
      </div>
      <div class="form-row"><label>Status</label>
        <select name="ativo">
          <option value="true" ${!editing||editing.ativo?"selected":""}>Ativo</option>
          <option value="false" ${editing&&!editing.ativo?"selected":""}>Inativo</option>
        </select>
      </div>
      <div class="form-row"><label>Observação</label><textarea name="observacao">${editing?escapeHtml(editing.observacao||""):""}</textarea></div>
      <div class="modal-actions">
        ${editing?`<button type="button" class="btn btn-danger" onclick="deleteCliente('${editing.id}')">Excluir</button>`:"<span></span>"}
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editing?"Salvar alterações":"Cadastrar cliente"}</button>
        </div>
      </div>
    </form>
  `);
  document.getElementById("clienteForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const data = { nome: fd.nome, telefone: fd.telefone, email: fd.email, observacao: fd.observacao, ativo: fd.ativo === "true" };
    if(editing){ Object.assign(editing, data); }
    else { DB.clientes.push({ id: uid(), bloqueado:false, ...data }); }
    saveDB(); closeModal(); render();
  });
}
function deleteCliente(id){
  if(!confirm("Excluir este cliente, seus serviços e pagamentos?")) return;
  const servIds = servicosDoCliente(id).map(s=>s.id);
  DB.clientes = DB.clientes.filter(c=>c.id!==id);
  DB.servicos = DB.servicos.filter(s=>s.clienteId!==id);
  DB.pagamentos = DB.pagamentos.filter(p=>!servIds.includes(p.servicoId));
  saveDB(); closeModal(); render();
}

/* =========================================================
   PÁGINA: PLANOS
========================================================= */
function renderPlanos(){
  pageContentEl.innerHTML = `
  <div class="toolbar">
    <div class="search-box"><span>🔍</span><input id="planoSearchInput" placeholder="Pesquisar plano" value=""></div>
    <div class="toolbar-right"><button class="btn btn-primary" onclick="openPlanoModal()">+ Novo plano</button></div>
  </div>
  <div id="planoListWrap"></div>
  `;
  document.getElementById("planoSearchInput").addEventListener("input", e=>renderPlanoList(e.target.value));
  renderPlanoList("");
}

function renderPlanoList(q){
  const wrap = document.getElementById("planoListWrap");
  let list = DB.planos.slice();
  if(q && q.trim()) list = list.filter(p=>p.nome.toLowerCase().includes(q.trim().toLowerCase()));

  if(list.length===0){ wrap.innerHTML = emptyPanel("📦","Nenhum plano encontrado","Crie planos como \"Mensal\", \"Trimestral\" ou \"Anual\"."); return; }

  const cards = list.map(p=>{
    const ciclo = CICLOS[p.ciclo] || CICLOS.mensal;
    const count = DB.servicos.filter(s=>s.planoId===p.id).length;
    return `
    <div class="plan-card">
      <div class="plan-actions">
        <button class="btn btn-orange btn-sm" onclick="openPlanoModal('${p.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deletePlano('${p.id}')">🗑️ Excluir</button>
      </div>
      <div class="plan-badge">${ciclo.label}</div>
      <div class="plan-icon">📦</div>
      <div class="plan-name">${escapeHtml(p.nome)}</div>
      <div class="plan-price">${fmtMoney(p.valor)}</div>
      <div class="plan-days">${ciclo.sufixo}</div>
      <div class="plan-count">👥 ${count} cliente(s)</div>
    </div>`;
  }).join("");

  wrap.innerHTML = `<div class="plan-grid">${cards}</div>`;
}

function openPlanoModal(id){
  const editing = id ? planoById(id) : null;
  openModal(`
    <button class="icon-btn modal-close" onclick="closeModal()">✕</button>
    <h2>${editing?"Editar plano":"Novo plano"}</h2>
    <form id="planoForm">
      <div class="form-row"><label>Nome do plano</label><input name="nome" required value="${editing?escapeHtml(editing.nome):""}"></div>
      <div class="form-grid-2">
        <div class="form-row"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" min="0" required value="${editing?editing.valor:""}"></div>
        <div class="form-row"><label>Ciclo</label>
          <select name="ciclo">
            ${Object.entries(CICLOS).map(([k,v])=>`<option value="${k}" ${editing&&editing.ciclo===k?"selected":""}>${v.label}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="modal-actions">
        ${editing?`<button type="button" class="btn btn-danger" onclick="deletePlano('${editing.id}')">Excluir</button>`:"<span></span>"}
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editing?"Salvar":"Criar plano"}</button>
        </div>
      </div>
    </form>
  `);
  document.getElementById("planoForm").addEventListener("submit", e=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if(editing){ Object.assign(editing, { nome: fd.nome, valor: Number(fd.valor), ciclo: fd.ciclo }); }
    else { DB.planos.push({ id: uid(), nome: fd.nome, valor: Number(fd.valor), ciclo: fd.ciclo }); }
    saveDB(); closeModal(); render();
  });
}
function deletePlano(id){
  if(!confirm("Excluir este plano? Serviços vinculados ficarão sem plano.")) return;
  DB.planos = DB.planos.filter(p=>p.id!==id);
  DB.servicos.forEach(s=>{ if(s.planoId===id) s.planoId=""; });
  saveDB(); closeModal(); render();
}

/* =========================================================
   PÁGINA: FORNECEDORES
========================================================= */
function renderFornecedores(){
  pageContentEl.innerHTML = `
  <div class="toolbar">
    <div class="toolbar-right" style="margin-left:0;"><button class="btn btn-primary" onclick="openFornecedorModal()">+ Novo fornecedor</button></div>
  </div>
  ${DB.fornecedores.length ? `<div class="plan-grid">${DB.fornecedores.map(f=>`
    <div class="plan-card">
      <div class="plan-icon">🏢</div>
      <div class="plan-name">${escapeHtml(f.nome)}</div>
      <div class="plan-price">${fmtMoney(f.custo)}</div>
      <div class="plan-days">custo</div>
      <div class="modal-actions" style="margin-top:16px;">
        <button class="btn btn-orange btn-sm" onclick="openFornecedorModal('${f.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteFornecedor('${f.id}')">🗑️ Excluir</button>
      </div>
    </div>`).join("")}</div>` : emptyPanel("🏢","Nenhum fornecedor cadastrado","Cadastre os servidores/painéis IPTV que você utiliza.")}
  `;
}
function openFornecedorModal(id){
  const editing = id ? fornecedorById(id) : null;
  openModal(`
    <button class="icon-btn modal-close" onclick="closeModal()">✕</button>
    <h2>${editing?"Editar fornecedor":"Novo fornecedor"}</h2>
    <form id="fornForm">
      <div class="form-row"><label>Nome</label><input name="nome" required value="${editing?escapeHtml(editing.nome):""}"></div>
      <div class="form-row"><label>Custo (R$)</label><input name="custo" type="number" step="0.01" min="0" value="${editing?editing.custo:0}"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${editing?"Salvar":"Cadastrar"}</button>
      </div>
    </form>
  `);
  document.getElementById("fornForm").addEventListener("submit", e=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if(editing) Object.assign(editing, { nome: fd.nome, custo: Number(fd.custo) });
    else DB.fornecedores.push({ id: uid(), nome: fd.nome, custo: Number(fd.custo) });
    saveDB(); closeModal(); render();
  });
}
function deleteFornecedor(id){
  if(!confirm("Excluir este fornecedor?")) return;
  DB.fornecedores = DB.fornecedores.filter(f=>f.id!==id);
  DB.servicos.forEach(s=>{ if(s.fornecedorId===id) s.fornecedorId=""; });
  saveDB(); render();
}

/* =========================================================
   PÁGINA: FINANCEIRO
   Resumo do mês — calculado a partir dos pagamentos reais dos
   clientes e do custo dos fornecedores cadastrados.
========================================================= */
let finMonth = todayISO().slice(0,7);

function renderFinanceiro(){
  pageContentEl.innerHTML = `
  <div class="section-header"><h2>📊 Resumo do mês</h2></div>
  <div class="toolbar">
    <div class="field-inline">📅 <input type="month" id="finMonthInput" value="${finMonth}"></div>
  </div>
  <div id="finResumoWrap"></div>
  `;
  document.getElementById("finMonthInput").addEventListener("change", e=>{ finMonth = e.target.value; renderFinResumo(); });
  renderFinResumo();
}

function renderFinResumo(){
  const wrap = document.getElementById("finResumoWrap");
  if(!wrap) return;

  const vencendoNoMes = DB.pagamentos.filter(p => (p.vencimento||"").slice(0,7) === finMonth);
  const pagosNoMes = DB.pagamentos.filter(p => p.status==="pago" && (p.dataPagamento||"").slice(0,7) === finMonth);

  const recebidoClientes = pagosNoMes.reduce((s,p)=>s+Number(p.valor),0);
  const aReceberClientes = vencendoNoMes.filter(p=>p.status!=="pago").reduce((s,p)=>s+Number(p.valor),0);

  // união (para a tabela por cliente): tanto quem vence neste mês quanto quem pagou neste mês
  const pagamentosDoMesMap = new Map();
  vencendoNoMes.forEach(p=>pagamentosDoMesMap.set(p.id,p));
  pagosNoMes.forEach(p=>pagamentosDoMesMap.set(p.id,p));
  const pagamentosDoMes = Array.from(pagamentosDoMesMap.values());

  const servicosAtivos = DB.servicos.filter(s=>{ const c = clienteById(s.clienteId); return c && c.ativo; });
  const custoFornecedores = servicosAtivos.reduce((s,serv)=>{ const f = fornecedorById(serv.fornecedorId); return s + (f ? Number(f.custo)||0 : 0); }, 0);

  const lucroRecebido = recebidoClientes - custoFornecedores;
  const lucroPrevisto = (recebidoClientes + aReceberClientes) - custoFornecedores;

  wrap.innerHTML = `
    <div class="grid-cards">
      <div class="stat-card">
        <div class="label">📥 Recebido de clientes — ${monthLabel(finMonth)}</div>
        <div class="value green">${fmtMoney(recebidoClientes)}</div>
      </div>
      <div class="stat-card">
        <div class="label">⏳ A receber de clientes</div>
        <div class="value yellow">${fmtMoney(aReceberClientes)}</div>
      </div>
      <div class="stat-card">
        <div class="label">🏢 Custo mensal com fornecedores</div>
        <div class="value red">${fmtMoney(custoFornecedores)}</div>
      </div>
      <div class="stat-card">
        <div class="label">💰 Lucro do mês (recebido − fornecedores)</div>
        <div class="value ${lucroRecebido>=0?'green':'red'}">${fmtMoney(lucroRecebido)}</div>
      </div>
    </div>
    <div class="hint" style="margin: -6px 0 18px;">
      Se todo o valor pendente deste mês for recebido, o lucro sobe para <b>${fmtMoney(lucroPrevisto)}</b>.
      O custo de fornecedores é calculado com base nos serviços dos clientes ativos cadastrados agora
      (não varia por mês, pois é um custo recorrente).
    </div>
    ${renderFinClienteTable(pagamentosDoMes)}
  `;
}

function renderFinClienteTable(pagamentosDoMes){
  if(DB.servicos.length===0){
    return emptyPanel("💳","Nenhum serviço cadastrado","Cadastre clientes, planos e fornecedores para ver o lucro por cliente aqui.");
  }
  const rows = DB.servicos.map(s=>{
    const c = clienteById(s.clienteId);
    if(!c) return "";
    const plano = planoById(s.planoId);
    const forn = fornecedorById(s.fornecedorId);
    const custo = forn ? Number(forn.custo)||0 : 0;
    const margem = Number(s.valor) - custo;
    const pag = pagamentosDoMes.find(p=>p.servicoId===s.id);
    const statusLabel = pag ? statusPillFor(pag.status) : `<span class="status-pill status-inativo">Sem cobrança no mês</span>`;
    return `
    <tr>
      <td><div class="cell-name">${escapeHtml(c.nome)} ${!c.ativo?`<span class="status-pill status-inativo" style="margin-left:6px;">Inativo</span>`:""}</div></td>
      <td>${plano ? escapeHtml(plano.nome) : "—"}</td>
      <td>${fmtMoney(s.valor)}</td>
      <td>${forn ? escapeHtml(forn.nome) : "—"}</td>
      <td>${fmtMoney(custo)}</td>
      <td style="color:${margem>=0?'var(--green)':'var(--red)'}; font-weight:600;">${fmtMoney(margem)}</td>
      <td>${statusLabel}</td>
    </tr>`;
  }).join("");

  return `<div class="panel" style="overflow:auto;"><table><thead><tr>
    <th>Cliente</th><th>Plano</th><th>Valor cobrado</th><th>Fornecedor</th><th>Custo fornecedor</th><th>Margem</th><th>Pagamento no mês</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* =========================================================
   PÁGINA: TEMPLATES DE MENSAGEM
========================================================= */
function renderTemplates(){
  pageContentEl.innerHTML = `
  <div class="toolbar">
    <div class="toolbar-right" style="margin-left:0;"><button class="btn btn-primary" onclick="openTemplateModal()">+ Criar template</button></div>
  </div>
  <div class="section-header"><h2>💬 Templates de mensagem personalizados</h2></div>
  ${DB.templates.length ? `<div class="msg-grid">${DB.templates.map(t=>{
      const tipoInfo = TEMPLATE_TIPOS[t.tipo] || TEMPLATE_TIPOS.outro;
      return `
    <div class="msg-card">
      <div class="msg-title">${escapeHtml(t.nome)} <span class="status-pill ${tipoInfo.cls}" style="margin-left:6px;">${tipoInfo.label}</span></div>
      <div class="msg-body">${escapeHtml(t.texto)}</div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <span class="tag-var">{nome}</span><span class="tag-var">{plano}</span><span class="tag-var">{valor}</span><span class="tag-var">{vencimento}</span>
      </div>
      <div class="msg-actions">
        <button class="btn btn-ghost btn-sm" onclick="copyTemplate('${t.id}')">📋 Copiar</button>
        <button class="btn btn-ghost btn-sm" onclick="openTemplateModal('${t.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTemplate('${t.id}')">🗑️</button>
      </div>
    </div>`;
    }).join("")}</div>` : emptyPanel("💬","Nenhum template cadastrado","Crie modelos de mensagem para enviar cobranças pelo WhatsApp.")}
  `;
}
function openTemplateModal(id){
  const editing = id ? DB.templates.find(t=>t.id===id) : null;
  openModal(`
    <button class="icon-btn modal-close" onclick="closeModal()">✕</button>
    <h2>${editing?"Editar template":"Novo template"}</h2>
    <form id="tplForm">
      <div class="form-row"><label>Nome do template</label><input name="nome" required value="${editing?escapeHtml(editing.nome):""}"></div>
      <div class="form-row">
        <label>Tipo</label>
        <select name="tipo">
          ${Object.entries(TEMPLATE_TIPOS).map(([key,info])=>`<option value="${key}" ${(editing?editing.tipo:"lembrete")===key?"selected":""}>${info.label}</option>`).join("")}
        </select>
        <div class="hint">O tipo "Aviso de bloqueio" é usado automaticamente ao enviar avisos para clientes com pagamento vencido.</div>
      </div>
      <div class="form-row">
        <label>Mensagem</label>
        <textarea name="texto" rows="6" required>${editing?escapeHtml(editing.texto):""}</textarea>
        <div class="hint">Use as variáveis: {nome}, {plano}, {valor}, {vencimento}</div>
      </div>
      <div class="modal-actions">
        ${editing?`<button type="button" class="btn btn-danger" onclick="deleteTemplate('${editing.id}')">Excluir</button>`:"<span></span>"}
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editing?"Salvar":"Criar"}</button>
        </div>
      </div>
    </form>
  `);
  document.getElementById("tplForm").addEventListener("submit", e=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if(editing) Object.assign(editing, fd);
    else DB.templates.push({ id: uid(), ...fd });
    saveDB(); closeModal(); render();
  });
}
function deleteTemplate(id){
  if(!confirm("Excluir este template?")) return;
  DB.templates = DB.templates.filter(t=>t.id!==id);
  saveDB(); closeModal(); render();
}
function copyTemplate(id){
  const t = DB.templates.find(x=>x.id===id);
  navigator.clipboard.writeText(t.texto).then(()=>alert("Template copiado para a área de transferência!"));
}

/* -------------------- empty state helper -------------------- */
function emptyPanel(emoji, title, sub){
  return `<div class="panel"><div class="empty-state"><div class="emoji">${emoji}</div><h3>${title}</h3><p>${sub}</p></div></div>`;
}

/* =========================================================
   MODAL GENÉRICO
========================================================= */
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
function openModal(html){
  modalBox.innerHTML = `<div style="position:relative;">${html}</div>`;
  modalOverlay.classList.add("open");
}
function closeModal(){ modalOverlay.classList.remove("open"); modalBox.innerHTML=""; }
modalOverlay.addEventListener("click", (e)=>{ if(e.target===modalOverlay) closeModal(); });

/* =========================================================
   TEMA
========================================================= */
const themeBtn = document.getElementById("themeBtn");
function applyTheme(t){
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("iptv_theme", t);
  themeBtn.textContent = t==="light" ? "🌞" : "🌙";
}
themeBtn.addEventListener("click", ()=>{
  const cur = document.documentElement.getAttribute("data-theme")==="light" ? "dark":"light";
  applyTheme(cur);
});
applyTheme(localStorage.getItem("iptv_theme") || "dark");

/* =========================================================
   BACKUP (exportar / importar JSON)
========================================================= */
document.getElementById("backupBtn").addEventListener("click", ()=>{
  const choice = confirm("Clique OK para EXPORTAR seu backup (baixa um arquivo .json).\nClique Cancelar para IMPORTAR um backup existente.");
  if(choice){
    const blob = new Blob([JSON.stringify(DB,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `backup-iptv-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
  } else {
    document.getElementById("importFile").click();
  }
});
document.getElementById("importFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      DB = JSON.parse(reader.result);
      saveDB(); render();
      alert("Backup importado com sucesso!");
    }catch(err){ alert("Arquivo inválido."); }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* =========================================================
   SINCRONIZAÇÃO COM GITHUB
========================================================= */
const SYNC_KEY = "iptv_github_sync_v1";
let syncTimer = null;
let syncInFlight = false;

function getSyncConfig(){
  const raw = localStorage.getItem(SYNC_KEY);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}
function setSyncConfig(cfg){ localStorage.setItem(SYNC_KEY, JSON.stringify(cfg)); }
function clearSyncConfig(){ localStorage.removeItem(SYNC_KEY); }

function setSyncStatus(state, text){
  const el = document.getElementById("syncStatus");
  if(!el) return;
  el.className = "sync-status " + (state||"");
  const icons = { ok:"☁️", pending:"🔄", error:"⚠️", "":"☁️" };
  el.textContent = `${icons[state]||"☁️"} ${text}`;
}
function refreshSyncIndicator(){
  const cfg = getSyncConfig();
  if(!cfg){ setSyncStatus("", "Não conectado"); return; }
  const last = cfg.lastSyncedAt ? new Date(cfg.lastSyncedAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : null;
  setSyncStatus("ok", last ? `Sincronizado ${last}` : "Conectado");
}
function b64Encode(str){ return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_,p1)=>String.fromCharCode(parseInt(p1,16)))); }
function b64Decode(str){ return decodeURIComponent(atob(str.replace(/\s/g,"")).split("").map(c=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join("")); }
function githubApiUrl(cfg, extra){ return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(cfg.path)}${extra||""}`; }

async function githubGetFile(cfg){
  const res = await fetch(githubApiUrl(cfg, `?ref=${encodeURIComponent(cfg.branch||"main")}`), {
    headers: { "Authorization": `token ${cfg.token}`, "Accept": "application/vnd.github+json" }
  });
  if(res.status === 404) return { exists:false };
  if(!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
  const json = await res.json();
  return { exists:true, sha: json.sha, content: JSON.parse(b64Decode(json.content)) };
}
async function githubPutFile(cfg, dataObj, sha){
  const body = { message: `Atualização de dados — ${new Date().toLocaleString("pt-BR")}`, content: b64Encode(JSON.stringify(dataObj, null, 2)), branch: cfg.branch || "main" };
  if(sha) body.sha = sha;
  const res = await fetch(githubApiUrl(cfg), { method: "PUT", headers: { "Authorization": `token ${cfg.token}`, "Accept": "application/vnd.github+json" }, body: JSON.stringify(body) });
  if(!res.ok){ const err = await res.json().catch(()=>({})); throw new Error(err.message || `GitHub respondeu ${res.status}`); }
  return res.json();
}
function scheduleSync(){
  const cfg = getSyncConfig();
  if(!cfg) return;
  setSyncStatus("pending", "Alterações pendentes…");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(()=>{ syncNow(); }, 2500);
}
async function syncNow(){
  const cfg = getSyncConfig();
  if(!cfg || syncInFlight) return;
  syncInFlight = true;
  setSyncStatus("pending", "Sincronizando…");
  try{
    const remote = await githubGetFile(cfg);
    const sha = remote.exists ? remote.sha : undefined;
    await githubPutFile(cfg, DB, sha);
    cfg.lastSyncedAt = Date.now();
    setSyncConfig(cfg);
    refreshSyncIndicator();
  }catch(err){
    console.error("Erro ao sincronizar com GitHub:", err);
    setSyncStatus("error", "Erro ao sincronizar");
  }finally{ syncInFlight = false; }
}
async function loadFromGithubOnBoot(){
  const cfg = getSyncConfig();
  if(!cfg) return;
  setSyncStatus("pending", "Carregando da nuvem…");
  try{
    const remote = await githubGetFile(cfg);
    if(remote.exists && remote.content){
      const remoteUpdated = remote.content.updatedAt || 0;
      const localUpdated = DB.updatedAt || 0;
      if(remoteUpdated > localUpdated){
        DB = remote.content;
        saveDB({ skipSync:true });
        render();
      }
    }
    cfg.lastSyncedAt = Date.now();
    setSyncConfig(cfg);
    refreshSyncIndicator();
  }catch(err){
    console.error("Erro ao carregar do GitHub:", err);
    setSyncStatus("error", "Erro ao conectar");
  }
}
document.getElementById("syncBtn").addEventListener("click", openSyncModal);
function openSyncModal(){
  const cfg = getSyncConfig() || {};
  openModal(`
    <button class="icon-btn modal-close" onclick="closeModal()">✕</button>
    <h2>Sincronizar com GitHub</h2>
    <div class="token-warning">
      Seus dados serão salvos em um arquivo dentro de um repositório seu no GitHub, além de ficarem salvos aqui no navegador. Use um repositório <b>privado</b> e um token de acesso pessoal (fine-grained) com permissão apenas de <b>leitura/escrita de conteúdo</b> nesse repositório. O token fica salvo somente neste navegador.
    </div>
    <form id="syncForm">
      <div class="form-row"><label>Usuário/organização do GitHub</label><input name="owner" required value="${cfg.owner?escapeHtml(cfg.owner):""}" placeholder="ex: jadson"></div>
      <div class="form-row"><label>Nome do repositório</label><input name="repo" required value="${cfg.repo?escapeHtml(cfg.repo):""}" placeholder="ex: gestor-iptv-dados"></div>
      <div class="form-grid-2">
        <div class="form-row"><label>Branch</label><input name="branch" value="${cfg.branch?escapeHtml(cfg.branch):"main"}"></div>
        <div class="form-row"><label>Arquivo de dados</label><input name="path" value="${cfg.path?escapeHtml(cfg.path):"data.json"}"></div>
      </div>
      <div class="form-row">
        <label>Token de acesso pessoal (GitHub)</label>
        <input name="token" type="password" required value="${cfg.token?escapeHtml(cfg.token):""}" placeholder="ghp_xxxxxxxxxxxx">
        <div class="hint">Crie em: GitHub → Settings → Developer settings → Personal access tokens (fine-grained) → dê permissão "Contents: Read and write" apenas para este repositório.</div>
      </div>
      <div class="modal-actions" style="justify-content:space-between;">
        <button type="button" class="btn btn-danger" onclick="disconnectSync()">Desconectar</button>
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Conectar e sincronizar</button>
        </div>
      </div>
    </form>
  `);
  document.getElementById("syncForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const newCfg = { owner: fd.owner.trim(), repo: fd.repo.trim(), branch: (fd.branch||"main").trim(), path: (fd.path||"data.json").trim(), token: fd.token.trim() };
    setSyncConfig(newCfg);
    closeModal();
    setSyncStatus("pending", "Conectando…");
    try{
      await loadFromGithubOnBoot();
      await syncNow();
      alert("Conectado! A partir de agora, tudo que você alterar aqui também será salvo no seu repositório do GitHub.");
    }catch(err){ alert("Não foi possível conectar. Confira o usuário, repositório e o token."); }
  });
}
function disconnectSync(){
  if(!confirm("Desconectar do GitHub? Seus dados continuam salvos aqui no navegador, mas deixam de ser sincronizados na nuvem.")) return;
  clearSyncConfig(); closeModal(); refreshSyncIndicator();
}

/* -------------------- utils -------------------- */
function escapeHtml(str){
  if(str===undefined || str===null) return "";
  return String(str).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

/* -------------------- boot -------------------- */
document.getElementById("brandName").textContent = DB.empresa || "Minha IPTV";
document.getElementById("userAvatar").textContent = (DB.empresa||"U").charAt(0).toUpperCase();
goToPage("pagamentos");
refreshSyncIndicator();
loadFromGithubOnBoot();

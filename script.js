// MAPA DAS SUAS 5 CATEGORIAS PERSONALIZADAS
const CATEGORY_MAP = {
  saida_drome: { name: 'Saída Drome', icon: '🏠', defaultType: 'despesa' },
  saida_hec: { name: 'Saída H/E/C', icon: '🛒', defaultType: 'despesa' },
  contas: { name: 'Contas', icon: '📄', defaultType: 'despesa' },
  cofrinho: { name: 'Cofrinho', icon: '🐷', defaultType: 'despesa' },
  entrada: { name: 'Entrada', icon: '💰', defaultType: 'receita' }
};

let state = {
  transactions: [],
  currentMonthDate: new Date(),
  selectedType: 'despesa',
  selectedCategory: 'saida_drome',
  selectedDateISO: new Date().toISOString().split('T')[0],
  inputRaw: '0',
  searchQuery: ''
};

let currentEditId = null;

// INICIALIZAÇÃO DA APLICAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  setupEventListeners();
  updateMonthLabel();
  setLaunchDate(new Date());
  renderDashboard();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').then((reg) => {
      reg.update();
    });
  }
});

// ARMAZENAMENTO E MIGRAÇÃO AUTOMÁTICA DE DADOS ANTIGOS
function loadFromLocalStorage() {
  const saved = localStorage.getItem('cofrinho_pro_txs') || localStorage.getItem('cofrinho_txs');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.transactions = parsed.map((tx, index) => ({
        id: tx.id || (Date.now() + index),
        description: tx.description || '',
        amount: parseFloat(tx.amount) || 0,
        type: tx.type || (tx.category === 'entrada' ? 'receita' : 'despesa'),
        category: CATEGORY_MAP[tx.category] ? tx.category : 'saida_drome',
        date: tx.date || new Date().toISOString().split('T')[0]
      }));
      saveToLocalStorage();
    } catch (e) {
      state.transactions = [];
    }
  }
}

function saveToLocalStorage() {
  localStorage.setItem('cofrinho_pro_txs', JSON.stringify(state.transactions));
}

// FORMATADOR DE MOEDA (R$)
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function getMonthKey(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
}

// RENDERIZAR PAINEL E HISTÓRICO
function renderDashboard() {
  const currentKey = getMonthKey(state.currentMonthDate);
  
  const monthTxs = state.transactions.filter(tx => {
    const matchesMonth = tx.date.startsWith(currentKey);
    const matchesSearch = tx.description.toLowerCase().includes(state.searchQuery.toLowerCase());
    return matchesMonth && matchesSearch;
  });

  let totalBalance = 0;
  let monthIncome = 0;
  let monthExpense = 0;

  state.transactions.forEach(tx => {
    if (tx.type === 'receita') {
      totalBalance += tx.amount;
    } else {
      totalBalance -= tx.amount;
    }
  });

  monthTxs.forEach(tx => {
    if (tx.type === 'receita') {
      monthIncome += tx.amount;
    } else {
      monthExpense += tx.amount;
    }
  });

  document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
  document.getElementById('monthIncome').textContent = formatCurrency(monthIncome);
  document.getElementById('monthExpense').textContent = formatCurrency(monthExpense);
  document.getElementById('txCountBadge').textContent = monthTxs.length;

  const listEl = document.getElementById('transactionsList');
  listEl.innerHTML = '';

  if (monthTxs.length === 0) {
    listEl.innerHTML = '<p style="text-align:center; color:#a0a0a5; padding:20px;">Nenhum gasto neste mês.</p>';
    return;
  }

  monthTxs.sort((a, b) => new Date(b.date) - new Date(a.date));

  monthTxs.forEach(tx => {
    const cat = CATEGORY_MAP[tx.category] || CATEGORY_MAP.saida_drome;
    const item = document.createElement('div');
    item.className = 'tx-item';
    
    const [y, m, d] = tx.date.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    item.innerHTML = `
      <div class="tx-info">
        <div class="tx-icon">${cat.icon}</div>
        <div class="tx-details">
          <span class="tx-desc">${tx.description || cat.name}</span>
          <span class="tx-date">${formattedDate} • ${cat.name}</span>
        </div>
      </div>
      <span class="tx-amount ${tx.type}">${tx.type === 'receita' ? '+' : '-'} ${formatCurrency(tx.amount)}</span>
    `;

    item.addEventListener('click', () => openEditModal(tx.id));
    listEl.appendChild(item);
  });
}

function updateMonthLabel() {
  const options = { month: 'long', year: 'numeric' };
  document.getElementById('currentMonthLabel').textContent = state.currentMonthDate.toLocaleDateString('pt-BR', options);
}

function setLaunchDate(dateObj) {
  state.selectedDateISO = dateObj.toISOString().split('T')[0];
  const [year, month, day] = state.selectedDateISO.split('-');
  const todayISO = new Date().toISOString().split('T')[0];
  const prefix = (state.selectedDateISO === todayISO) ? 'Hoje, ' : '';
  
  document.getElementById('datePickerBtn').textContent = `${prefix}${day}/${month}/${year}`;
  document.getElementById('hiddenDateInput').value = state.selectedDateISO;
}

// BIND DOS EVENTOS
function setupEventListeners() {
  document.getElementById('navHome').addEventListener('click', () => switchView('view-dashboard', 'navHome'));
  document.getElementById('navAdd').addEventListener('click', () => switchView('view-teclado', 'navAdd'));
  document.getElementById('navSettings').addEventListener('click', () => openModal('modalSettings'));
  document.getElementById('btnSettings').addEventListener('click', () => openModal('modalSettings'));

  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    state.currentMonthDate.setMonth(state.currentMonthDate.getMonth() - 1);
    updateMonthLabel();
    renderDashboard();
  });
  document.getElementById('btnNextMonth').addEventListener('click', () => {
    state.currentMonthDate.setMonth(state.currentMonthDate.getMonth() + 1);
    updateMonthLabel();
    renderDashboard();
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderDashboard();
  });

  document.getElementById('typeExpenseBtn').addEventListener('click', () => setType('despesa'));
  document.getElementById('typeIncomeBtn').addEventListener('click', () => setType('receita'));

  document.getElementById('hiddenDateInput').addEventListener('change', (e) => {
    if (e.target.value) setLaunchDate(new Date(e.target.value + 'T00:00:00'));
  });

  // Seletor de Categoria
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedCategory = btn.dataset.cat;

      if (state.selectedCategory === 'entrada') {
        setType('receita');
      } else {
        setType('despesa');
      }
    });
  });

  // Teclado
  document.querySelectorAll('.num-btn[data-val]').forEach(btn => {
    btn.addEventListener('click', () => handleNumInput(btn.dataset.val));
  });
  document.getElementById('btnBackspace').addEventListener('click', handleBackspace);

  // Salvar
  document.getElementById('btnSaveTransaction').addEventListener('click', saveTransaction);

  // Modais
  document.getElementById('btnCancelEdit').addEventListener('click', () => closeModal('modalEdit'));
  document.getElementById('btnCloseSettings').addEventListener('click', () => closeModal('modalSettings'));
  document.getElementById('btnSaveEdit').addEventListener('click', saveEditedTransaction);
  document.getElementById('btnDeleteTx').addEventListener('click', deleteTransaction);

  // Backup
  document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
  document.getElementById('importFile').addEventListener('change', importBackup);
}

function switchView(viewId, navId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  if (navId) document.getElementById(navId).classList.add('active');
}

function setType(type) {
  state.selectedType = type;
  document.getElementById('typeExpenseBtn').className = `type-btn expense ${type === 'despesa' ? 'active' : ''}`;
  document.getElementById('typeIncomeBtn').className = `type-btn income ${type === 'receita' ? 'active' : ''}`;
  document.getElementById('displayAmount').style.color = (type === 'receita') ? '#30d158' : '#ff453a';
}

function handleNumInput(val) {
  if (val === ',') {
    if (!state.inputRaw.includes(',')) state.inputRaw += ',';
  } else {
    if (state.inputRaw === '0') state.inputRaw = val;
    else state.inputRaw += val;
  }
  updateDisplayAmount();
}

function handleBackspace() {
  if (state.inputRaw.length > 1) {
    state.inputRaw = state.inputRaw.slice(0, -1);
  } else {
    state.inputRaw = '0';
  }
  updateDisplayAmount();
}

function updateDisplayAmount() {
  const parsed = parseFloat(state.inputRaw.replace(',', '.')) || 0;
  document.getElementById('displayAmount').textContent = formatCurrency(parsed);
}

function saveTransaction() {
  const amount = parseFloat(state.inputRaw.replace(',', '.'));
  if (!amount || amount <= 0) {
    alert('Por favor, digite um valor válido.');
    return;
  }

  const newTx = {
    id: Date.now(),
    description: document.getElementById('inputDescription').value.trim(),
    amount: amount,
    type: state.selectedType,
    category: state.selectedCategory,
    date: state.selectedDateISO
  };

  state.transactions.push(newTx);
  saveToLocalStorage();

  state.inputRaw = '0';
  document.getElementById('inputDescription').value = '';
  updateDisplayAmount();

  switchView('view-dashboard', 'navHome');
  renderDashboard();
}

// MODAL DE EDIÇÃO
function openEditModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  currentEditId = id;
  document.getElementById('editDesc').value = tx.description || '';
  document.getElementById('editAmount').value = tx.amount;
  document.getElementById('editType').value = tx.type;
  document.getElementById('editCategory').value = tx.category;
  document.getElementById('editDate').value = tx.date;

  openModal('modalEdit');
}

function saveEditedTransaction() {
  if (!currentEditId) return;

  const desc = document.getElementById('editDesc').value;
  const amount = parseFloat(document.getElementById('editAmount').value);
  const type = document.getElementById('editType').value;
  const category = document.getElementById('editCategory').value;
  const date = document.getElementById('editDate').value;

  if (!amount || amount <= 0 || !date) {
    alert('Preencha os campos corretamente.');
    return;
  }

  const idx = state.transactions.findIndex(t => t.id === currentEditId);
  if (idx !== -1) {
    state.transactions[idx] = { id: currentEditId, description: desc, amount, type, category, date };
    saveToLocalStorage();
    renderDashboard();
    closeModal('modalEdit');
  }
}

function deleteTransaction() {
  if (!currentEditId) return;
  if (confirm('Deseja eliminar este lançamento?')) {
    state.transactions = state.transactions.filter(t => t.id !== currentEditId);
    saveToLocalStorage();
    renderDashboard();
    closeModal('modalEdit');
  }
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// EXPORTAR E IMPORTAR BACKUP
function exportBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.transactions, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `cofrinho_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      if (Array.isArray(imported)) {
        state.transactions = imported;
        saveToLocalStorage();
        renderDashboard();
        alert('Backup restaurado com sucesso!');
        closeModal('modalSettings');
      }
    } catch (err) {
      alert('Ficheiro de backup inválido.');
    }
  };
  reader.readAsText(file);
}

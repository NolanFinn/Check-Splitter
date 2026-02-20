const STORAGE_KEY = 'check-splitter-state-v1';

const defaultState = {
  items: [],
  taxAmount: 0,
  tipAmount: 0,
  feeAmount: 0,
  people: ['Me'],
  payer: 'Me',
  assignments: {}
};

let state = loadState();

const el = {
  newCheckBtn: document.querySelector('#new-check-btn'),
  itemForm: document.querySelector('#item-form'),
  itemName: document.querySelector('#item-name'),
  itemQty: document.querySelector('#item-qty'),
  itemPrice: document.querySelector('#item-price'),
  itemError: document.querySelector('#item-error'),
  itemsBody: document.querySelector('#items-body'),
  taxAmount: document.querySelector('#tax-amount'),
  tipAmount: document.querySelector('#tip-amount'),
  feeAmount: document.querySelector('#fee-amount'),
  checkSummary: document.querySelector('#check-summary'),
  personForm: document.querySelector('#person-form'),
  personName: document.querySelector('#person-name'),
  personError: document.querySelector('#person-error'),
  peopleBody: document.querySelector('#people-body'),
  payerSelect: document.querySelector('#payer-select'),
  assignmentList: document.querySelector('#assignment-list'),
  finalBreakdownList: document.querySelector('#final-breakdown-list'),
  sections: [...document.querySelectorAll('.section')]
};

bindEvents();
render();

function bindEvents() {
  el.newCheckBtn.addEventListener('click', resetCheck);

  el.itemForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addItem();
  });
  el.itemName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      el.itemQty.focus();
    }
  });
  el.itemQty.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      el.itemPrice.focus();
    }
  });

  for (const field of [el.taxAmount, el.tipAmount, el.feeAmount]) {
    field.addEventListener('input', () => {
      state.taxAmount = toMoney(el.taxAmount.value);
      state.tipAmount = toMoney(el.tipAmount.value);
      state.feeAmount = toMoney(el.feeAmount.value);
      persist();
      renderDerived();
    });
  }

  el.personForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addPerson();
  });

  el.payerSelect.addEventListener('change', () => {
    state.payer = el.payerSelect.value;
    persist();
    renderFinalBreakdown(calculateShares());
  });

  setupSectionControls();
}

function resetCheck() {
  const shouldClear = window.confirm(
    'Start a new check? This clears all current data and it will not be saved.'
  );
  if (!shouldClear) return;

  state = structuredClone(defaultState);
  persist();
  render();
  setSectionOpen('create', true);
  el.itemName.focus();
}

function setupSectionControls() {
  el.sections.forEach((section) => {
    const toggle = section.querySelector('.section-toggle');
    const sectionName = section.dataset.section;
    toggle.addEventListener('click', () => {
      setSectionOpen(sectionName, toggle.getAttribute('aria-expanded') !== 'true');
    });

    const nextBtn = section.querySelector('.next-section');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const next = section.dataset.next;
        if (!next) return;
        setSectionOpen(next, true);
        document.querySelector(`.section[data-section="${next}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    setSectionOpen(sectionName, sectionName === 'create');
  });
}

function setSectionOpen(sectionName, open) {
  const section = document.querySelector(`.section[data-section="${sectionName}"]`);
  if (!section) return;
  const toggle = section.querySelector('.section-toggle');
  const content = section.querySelector('.section-content');
  section.querySelector('.chevron').textContent = open ? '▾' : '▸';
  toggle.setAttribute('aria-expanded', String(open));
  content.classList.toggle('hidden', !open);
}

function addItem() {
  const description = el.itemName.value.trim();
  const quantity = Number(el.itemQty.value);
  const price = Number(el.itemPrice.value);

  if (!description) return setItemError('Please enter an item name before saving.');
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    return setItemError('Quantity must be a whole number greater than 0.');
  }
  if (!Number.isFinite(price) || price < 0) {
    return setItemError('Price must be a valid non-negative amount.');
  }

  const id = crypto.randomUUID();
  state.items.push({ id, description, quantity, price: toMoney(price) });
  state.assignments[id] = [...state.people];

  el.itemForm.reset();
  el.itemQty.value = '1';
  setItemError('');
  persist();
  render();
  el.itemName.focus();
}

function addPerson() {
  const name = el.personName.value.trim();
  if (!name) {
    el.personError.textContent = 'Please enter a person name.';
    return;
  }
  if (state.people.includes(name)) {
    el.personError.textContent = 'That person already exists.';
    return;
  }

  state.people.push(name);
  el.personForm.reset();
  el.personError.textContent = '';
  persist();
  render();
  el.personName.focus();
}

function removePerson(person) {
  if (!state.people.includes(person)) return;
  if (state.people.length <= 1) {
    el.personError.textContent = 'At least one person is required.';
    return;
  }

  state.people = state.people.filter((p) => p !== person);
  if (state.payer === person) state.payer = state.people[0];

  state.items.forEach((item) => {
    const selected = state.assignments[item.id] || [];
    state.assignments[item.id] = selected.filter((p) => p !== person);
  });

  persist();
  render();
}

function setItemError(message) {
  el.itemError.textContent = message;
}

function render() {
  el.taxAmount.value = state.taxAmount === 0 ? '0' : String(state.taxAmount);
  el.tipAmount.value = state.tipAmount === 0 ? '0' : String(state.tipAmount);
  el.feeAmount.value = state.feeAmount === 0 ? '0' : String(state.feeAmount);

  renderItems();
  renderPeople();
  renderAssignments();
  renderDerived();
}

function renderDerived() {
  const results = calculateShares();
  renderSummary(results);
  renderFinalBreakdown(results);
}

function renderItems() {
  el.itemsBody.innerHTML = '';
  state.items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="number" class="inline-edit inline-qty" min="1" step="1" inputmode="numeric" value="${item.quantity}" aria-label="Edit quantity for ${item.description}" /></td>
      <td><input type="text" class="inline-edit" value="${escapeHtml(item.description)}" aria-label="Edit description for ${item.description}" /></td>
      <td><input type="number" class="inline-edit inline-price" min="0" step="0.01" inputmode="decimal" value="${money(item.price)}" aria-label="Edit total price for ${item.description}" /></td>
      <td>$${money(item.price / item.quantity)}</td>
      <td><button type="button" class="icon-btn remove" aria-label="Remove item">×</button></td>
    `;

    const qtyInput = tr.querySelector('.inline-qty');
    qtyInput.addEventListener('change', () => {
      const qty = Number(qtyInput.value);
      if (!Number.isInteger(qty) || qty <= 0) {
        qtyInput.value = String(item.quantity);
        return;
      }
      item.quantity = qty;
      persist();
      render();
    });

    const descriptionInput = tr.querySelector('input[type="text"]');
    descriptionInput.addEventListener('change', () => {
      const description = descriptionInput.value.trim();
      if (!description) {
        descriptionInput.value = item.description;
        return;
      }
      item.description = description;
      persist();
      render();
    });

    const priceInput = tr.querySelector('.inline-price');
    priceInput.addEventListener('change', () => {
      const price = Number(priceInput.value);
      if (!Number.isFinite(price) || price < 0) {
        priceInput.value = money(item.price);
        return;
      }
      item.price = toMoney(price);
      persist();
      render();
    });

    tr.querySelector('button').addEventListener('click', () => {
      state.items = state.items.filter((i) => i.id !== item.id);
      delete state.assignments[item.id];
      persist();
      render();
    });
    el.itemsBody.appendChild(tr);
  });
}

function renderPeople() {
  el.peopleBody.innerHTML = '';
  state.people.forEach((person) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${person}</td><td><button type="button" class="icon-btn remove" aria-label="Remove person">×</button></td>`;
    tr.querySelector('button').addEventListener('click', () => removePerson(person));
    el.peopleBody.appendChild(tr);
  });

  el.payerSelect.innerHTML = state.people
    .map((person) => `<option value="${person}" ${person === state.payer ? 'selected' : ''}>${person}</option>`)
    .join('');
}

function renderAssignments() {
  el.assignmentList.innerHTML = '';

  state.items.forEach((item) => {
    const selected = state.assignments[item.id] || [];
    const wrap = document.createElement('article');
    wrap.className = 'assignment-item';
    wrap.innerHTML = `
      <button type="button" class="assignment-header" aria-expanded="false">
        <span>${item.description} · $${money(item.price)}</span>
        <span class="meta">${selectionSummary(selected)} ▸</span>
      </button>
      <div class="assignment-content hidden">
        <div class="pill-wrap"></div>
      </div>
    `;

    const header = wrap.querySelector('.assignment-header');
    const content = wrap.querySelector('.assignment-content');
    const meta = wrap.querySelector('.meta');
    const pillWrap = wrap.querySelector('.pill-wrap');

    header.addEventListener('click', () => {
      const open = header.getAttribute('aria-expanded') !== 'true';
      header.setAttribute('aria-expanded', String(open));
      content.classList.toggle('hidden', !open);
      meta.textContent = `${selectionSummary(state.assignments[item.id] || [])} ${open ? '▾' : '▸'}`;
    });

    state.people.forEach((person) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pill ${(state.assignments[item.id] || []).includes(person) ? 'active' : ''}`;
      btn.textContent = person;
      btn.addEventListener('click', () => {
        const current = new Set(state.assignments[item.id] || []);
        if (current.has(person)) current.delete(person);
        else current.add(person);
        state.assignments[item.id] = [...current];
        btn.classList.toggle('active', current.has(person));
        meta.textContent = `${selectionSummary(state.assignments[item.id])} ${header.getAttribute('aria-expanded') === 'true' ? '▾' : '▸'}`;
        persist();
        renderDerived();
      });
      pillWrap.appendChild(btn);
    });

    el.assignmentList.appendChild(wrap);
  });
}

function selectionSummary(selected) {
  if (!selected || selected.length === 0) return 'Unassigned';
  if (selected.length === 1) return selected[0];
  return `${selected.length} 👥`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function calculateShares() {
  const subtotalCents = Math.round(state.items.reduce((sum, item) => sum + item.price, 0) * 100);
  const taxCents = Math.round(state.taxAmount * 100);
  const tipCents = Math.round(state.tipAmount * 100);
  const feeCents = Math.round(state.feeAmount * 100);

  const baseByPerson = Object.fromEntries(state.people.map((p) => [p, 0]));
  const itemBreakdown = Object.fromEntries(state.people.map((p) => [p, []]));

  state.items.forEach((item) => {
    const selected = state.assignments[item.id] || [];
    if (selected.length === 0) return;

    const total = Math.round(item.price * 100);
    const raw = total / selected.length;
    const floor = Math.floor(raw);
    const fractions = selected
      .map((person) => ({ person, frac: raw - floor }))
      .sort((a, b) => b.frac - a.frac || a.person.localeCompare(b.person));

    selected.forEach((person) => {
      baseByPerson[person] += floor;
      itemBreakdown[person].push({ label: `${item.description} share`, cents: floor });
    });

    const remainder = total - floor * selected.length;
    for (let i = 0; i < remainder; i += 1) {
      const person = fractions[i].person;
      baseByPerson[person] += 1;
      itemBreakdown[person][itemBreakdown[person].length - 1].cents += 1;
    }
  });

  const participants = state.people.filter((p) => baseByPerson[p] > 0);
  const addOnByPerson = Object.fromEntries(state.people.map((p) => [p, { tax: 0, tip: 0, fee: 0 }]));

  distributeProportionally(participants, baseByPerson, taxCents, (p, cents) => (addOnByPerson[p].tax += cents));
  distributeProportionally(participants, baseByPerson, tipCents, (p, cents) => (addOnByPerson[p].tip += cents));
  distributeProportionally(participants, baseByPerson, feeCents, (p, cents) => (addOnByPerson[p].fee += cents));

  const totalByPerson = Object.fromEntries(
    state.people.map((p) => [p, baseByPerson[p] + addOnByPerson[p].tax + addOnByPerson[p].tip + addOnByPerson[p].fee])
  );

  return {
    subtotalCents,
    taxCents,
    tipCents,
    feeCents,
    totalCents: subtotalCents + taxCents + tipCents + feeCents,
    taxPercent: subtotalCents > 0 ? (taxCents / subtotalCents) * 100 : 0,
    addOnByPerson,
    totalByPerson,
    itemBreakdown
  };
}

function distributeProportionally(participants, baseByPerson, totalCents, assignFn) {
  if (participants.length === 0 || totalCents === 0) return;
  const baseTotal = participants.reduce((sum, p) => sum + baseByPerson[p], 0);
  if (baseTotal === 0) return;

  const allocations = participants.map((person) => {
    const raw = (totalCents * baseByPerson[person]) / baseTotal;
    const floor = Math.floor(raw);
    return { person, floor, frac: raw - floor };
  });

  allocations.forEach((a) => assignFn(a.person, a.floor));
  const remaining = totalCents - allocations.reduce((sum, a) => sum + a.floor, 0);
  allocations.sort((a, b) => b.frac - a.frac || a.person.localeCompare(b.person));
  for (let i = 0; i < remaining; i += 1) {
    assignFn(allocations[i].person, 1);
  }
}

function renderSummary(results) {
  el.checkSummary.innerHTML = `
    Subtotal: $${moneyFromCents(results.subtotalCents)} ·
    Tax: $${moneyFromCents(results.taxCents)} (${results.taxPercent.toFixed(2)}%) ·
    Tip: $${moneyFromCents(results.tipCents)} ·
    Fees: $${moneyFromCents(results.feeCents)} ·
    <strong>Total due: $${moneyFromCents(results.totalCents)}</strong>
  `;
}

function renderFinalBreakdown(results) {
  el.finalBreakdownList.innerHTML = '';

  state.people.forEach((person) => {
    const total = results.totalByPerson[person] || 0;
    const itemLines = (results.itemBreakdown[person] || [])
      .map((item) => `<li>${item.label}: $${moneyFromCents(item.cents)}</li>`)
      .join('');

    const row = document.createElement('article');
    row.className = 'assignment-item';
    row.innerHTML = `
      <button type="button" class="assignment-header" aria-expanded="false">
        <span>${person}</span>
        <span class="meta">$${moneyFromCents(total)} ▸</span>
      </button>
      <div class="assignment-content hidden">
        ${itemLines ? `<ul>${itemLines}</ul>` : '<p class="muted">No items assigned.</p>'}
        <p>Tax: $${moneyFromCents(results.addOnByPerson[person].tax)}</p>
        <p>Tip: $${moneyFromCents(results.addOnByPerson[person].tip)}</p>
        <p>Fees: $${moneyFromCents(results.addOnByPerson[person].fee)}</p>
        <p><strong>Total: $${moneyFromCents(total)}</strong></p>
      </div>
    `;

    const header = row.querySelector('.assignment-header');
    const content = row.querySelector('.assignment-content');
    const meta = row.querySelector('.meta');

    header.addEventListener('click', () => {
      const open = header.getAttribute('aria-expanded') !== 'true';
      header.setAttribute('aria-expanded', String(open));
      content.classList.toggle('hidden', !open);
      meta.textContent = `$${moneyFromCents(total)} ${open ? '▾' : '▸'}`;
    });

    el.finalBreakdownList.appendChild(row);
  });
}

function toMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function money(value) {
  return toMoney(value).toFixed(2);
}

function moneyFromCents(cents) {
  return (cents / 100).toFixed(2);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed ? { ...defaultState, ...parsed } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

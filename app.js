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
  peopleList: document.querySelector('#people-list'),
  payerSelect: document.querySelector('#payer-select'),
  assignmentList: document.querySelector('#assignment-list'),
  settlementList: document.querySelector('#settlement-list'),
  personDetailList: document.querySelector('#person-detail-list'),
  sections: [...document.querySelectorAll('.section')]
};

bindEvents();
render();

function bindEvents() {
  el.itemForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addItem();
  });

  for (const field of [el.taxAmount, el.tipAmount, el.feeAmount]) {
    field.addEventListener('input', () => {
      state.taxAmount = toMoney(el.taxAmount.value);
      state.tipAmount = toMoney(el.tipAmount.value);
      state.feeAmount = toMoney(el.feeAmount.value);
      persist();
      renderSummary(calculateShares());
      renderSettlement(calculateShares());
      renderPersonDetails(calculateShares());
    });
  }

  el.personForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addPerson();
  });

  el.payerSelect.addEventListener('change', () => {
    state.payer = el.payerSelect.value;
    persist();
    renderSettlement(calculateShares());
  });

  setupSectionControls();
}

function setupSectionControls() {
  el.sections.forEach((section) => {
    const toggle = section.querySelector('.section-toggle');
    const content = section.querySelector('.section-content');
    const chevron = section.querySelector('.chevron');
    const sectionName = section.dataset.section;

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      setSectionOpen(sectionName, !expanded);
    });

    const nextBtn = section.querySelector('.next-section');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const next = section.dataset.next;
        if (!next) return;
        setSectionOpen(next, true);
        const nextEl = document.querySelector(`.section[data-section="${next}"]`);
        if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (sectionName !== 'create') {
      content.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
      chevron.textContent = '▸';
    } else {
      content.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      chevron.textContent = '▾';
    }
  });
}

function setSectionOpen(sectionName, open) {
  const section = document.querySelector(`.section[data-section="${sectionName}"]`);
  if (!section) return;
  const toggle = section.querySelector('.section-toggle');
  const content = section.querySelector('.section-content');
  const chevron = section.querySelector('.chevron');

  toggle.setAttribute('aria-expanded', String(open));
  content.classList.toggle('hidden', !open);
  chevron.textContent = open ? '▾' : '▸';
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

  state.items.push({ id: crypto.randomUUID(), description, quantity, price: toMoney(price) });
  state.assignments[state.items[state.items.length - 1].id] = [...state.people];

  el.itemForm.reset();
  el.itemQty.value = '1';
  setItemError('');
  persist();
  render();
  el.itemName.focus();
}

function setItemError(message) {
  el.itemError.textContent = message;
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
  for (const item of state.items) {
    if (!state.assignments[item.id]) state.assignments[item.id] = [];
  }

  el.personForm.reset();
  el.personError.textContent = '';
  persist();
  render();
  el.personName.focus();
}

function render() {
  el.taxAmount.value = state.taxAmount === 0 ? '0' : String(state.taxAmount);
  el.tipAmount.value = state.tipAmount === 0 ? '0' : String(state.tipAmount);
  el.feeAmount.value = state.feeAmount === 0 ? '0' : String(state.feeAmount);

  renderItems();
  renderPeople();
  renderAssignments();

  const results = calculateShares();
  renderSummary(results);
  renderSettlement(results);
  renderPersonDetails(results);
}

function renderItems() {
  el.itemsBody.innerHTML = '';
  state.items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.quantity}</td>
      <td>${item.description}</td>
      <td>$${money(item.price)}</td>
      <td>$${money(item.price / item.quantity)}</td>
      <td><button type="button" class="remove" data-id="${item.id}">Remove</button></td>
    `;

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
  el.peopleList.innerHTML = '';
  state.people.forEach((person) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = person;
    el.peopleList.appendChild(chip);
  });

  el.payerSelect.innerHTML = state.people
    .map((person) => `<option value="${person}" ${person === state.payer ? 'selected' : ''}>${person}</option>`)
    .join('');
}

function renderAssignments() {
  el.assignmentList.innerHTML = '';
  state.items.forEach((item) => {
    const wrap = document.createElement('div');
    wrap.className = 'assignment';
    wrap.innerHTML = `<strong>${item.quantity} ${item.description} ($${money(item.price)})</strong>`;

    const checks = document.createElement('div');
    checks.className = 'people-checks';

    state.people.forEach((person) => {
      const checked = (state.assignments[item.id] || []).includes(person);
      const id = `${item.id}-${person}`;
      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.innerHTML = `<input id="${id}" type="checkbox" ${checked ? 'checked' : ''} /> ${person}`;
      label.querySelector('input').addEventListener('change', (event) => {
        const selected = new Set(state.assignments[item.id] || []);
        if (event.target.checked) selected.add(person);
        else selected.delete(person);
        state.assignments[item.id] = [...selected];
        persist();
        render();
      });
      checks.appendChild(label);
    });

    wrap.appendChild(checks);
    el.assignmentList.appendChild(wrap);
  });
}

function calculateShares() {
  const subtotalCents = Math.round(state.items.reduce((sum, item) => sum + item.price, 0) * 100);
  const taxCents = Math.round(state.taxAmount * 100);
  const tipCents = Math.round(state.tipAmount * 100);
  const feeCents = Math.round(state.feeAmount * 100);

  const baseByPerson = Object.fromEntries(state.people.map((person) => [person, 0]));
  const itemBreakdown = Object.fromEntries(state.people.map((person) => [person, []]));

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
    });

    let remainder = total - floor * selected.length;
    for (let i = 0; i < remainder; i += 1) {
      baseByPerson[fractions[i].person] += 1;
    }

    selected.forEach((person) => {
      const assignedSoFar = itemBreakdown[person].reduce((sum, detail) => sum + detail.cents, 0);
      const portion = baseByPerson[person] - assignedSoFar;
      itemBreakdown[person].push({ label: `${item.description} share`, cents: portion });
    });
  });

  const participants = state.people.filter((person) => baseByPerson[person] > 0);
  const addOnByPerson = Object.fromEntries(state.people.map((person) => [person, { tax: 0, tip: 0, fee: 0 }]));

  distributeProportionally(participants, baseByPerson, taxCents, (person, cents) => (addOnByPerson[person].tax += cents));
  distributeProportionally(participants, baseByPerson, tipCents, (person, cents) => (addOnByPerson[person].tip += cents));
  distributeProportionally(participants, baseByPerson, feeCents, (person, cents) => (addOnByPerson[person].fee += cents));

  const totalByPerson = Object.fromEntries(
    state.people.map((person) => [
      person,
      baseByPerson[person] + addOnByPerson[person].tax + addOnByPerson[person].tip + addOnByPerson[person].fee
    ])
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
  const baseTotal = participants.reduce((sum, person) => sum + baseByPerson[person], 0);
  if (baseTotal === 0) return;

  const allocations = participants.map((person) => {
    const raw = (totalCents * baseByPerson[person]) / baseTotal;
    const floor = Math.floor(raw);
    return { person, floor, frac: raw - floor };
  });

  allocations.forEach((entry) => assignFn(entry.person, entry.floor));

  let remaining = totalCents - allocations.reduce((sum, entry) => sum + entry.floor, 0);
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

function renderSettlement(results) {
  const payer = state.payer;
  const lines = state.people
    .filter((person) => person !== payer && results.totalByPerson[person] > 0)
    .map((person) => `<li>${person} owes ${payer} <strong>$${moneyFromCents(results.totalByPerson[person])}</strong></li>`)
    .join('');

  el.settlementList.innerHTML = lines ? `<ul>${lines}</ul>` : '<p class="muted">No one owes anything yet.</p>';
}

function renderPersonDetails(results) {
  el.personDetailList.innerHTML = '';

  state.people.forEach((person) => {
    const card = document.createElement('article');
    card.className = 'person-card';

    const details = results.itemBreakdown[person] || [];
    const itemsMarkup = details.length
      ? `<ul>${details.map((item) => `<li>${item.label}: $${moneyFromCents(item.cents)}</li>`).join('')}</ul>`
      : '<p class="muted">No items assigned.</p>';

    card.innerHTML = `
      <h3>${person}</h3>
      ${itemsMarkup}
      <p>Tax: $${moneyFromCents(results.addOnByPerson[person].tax)}</p>
      <p>Tip: $${moneyFromCents(results.addOnByPerson[person].tip)}</p>
      <p>Fees: $${moneyFromCents(results.addOnByPerson[person].fee)}</p>
      <p><strong>Total: $${moneyFromCents(results.totalByPerson[person])}</strong></p>
    `;

    el.personDetailList.appendChild(card);
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

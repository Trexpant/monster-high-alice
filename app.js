const DB_NAME = 'monster-high-archive';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const generations = [
  { id: 'g1', label: 'G1', name: 'O elenco clássico', period: 'A linha original, iniciada em 2010.' },
  { id: 'g2', label: 'G2', name: 'O reboot de 2016', period: 'A segunda geração da linha, lançada em 2016.' },
  { id: 'g3', label: 'G3', name: 'A nova geração', period: 'O novo começo de Monster High, a partir de 2022.' },
];

const seedCollections = [
  { id: 'g1-wave-2010', generation: 'g1', name: 'Primeira onda · 2010', description: 'As seis personagens que deram início a tudo.', names: ['Frankie Stein', 'Draculaura', 'Clawdeen Wolf', 'Lagoona Blue', 'Cleo de Nile', 'Deuce Gorgon'] },
  { id: 'g1-classic', generation: 'g1', name: 'Elenco clássico · 2011–2013', description: 'As personagens que ampliaram o elenco original.', names: ['Ghoulia Yelps', 'Abbey Bominable', 'Spectra Vondergeist', 'Operetta', 'Toralei Stripe', 'Purrsephone', 'Meowlody', 'Venus McFlytrap', 'Rochelle Goyle', 'Robecca Steam', 'Twyla', 'Howleen Wolf', 'Nefera de Nile', 'Clawd Wolf'] },
  { id: 'g1-scaris', generation: 'g1', name: 'Scaris: City of Frights', description: 'A viagem monstruosa a Paris, com novas personagens.', names: ['Skelita Calaveras', 'Jinafire Long'] },
  { id: 'g1-13-wishes', generation: 'g1', name: '13 Wishes', description: 'Uma nova gênia chega à escola.', names: ['Gigi Grant'] },
  { id: 'g1-freaky-fusion', generation: 'g1', name: 'Freaky Fusion', description: 'Personagens híbridas e combinações inesperadas.', names: ['Dracubecca', 'Clawvenus', 'Lagoonafire', 'Sirena Von Boo'] },
  { id: 'g1-film', generation: 'g1', name: 'Filmes e personagens especiais', description: 'Outras personagens marcantes do universo clássico.', names: ['Catty Noir', 'Honey Swamp', 'Elissabat', 'Gil Webber', 'Jackson Jekyll', 'Holt Hyde', 'Heath Burns', 'Invisi Billy', 'Manny Taur'] },
  { id: 'g2-reboot', generation: 'g2', name: 'Reboot · 2016', description: 'O texto-base identifica a G2 como o reboot de 2016, mas não lista personagens.', names: [] },
  { id: 'g3-core', generation: 'g3', name: 'Núcleo G3 · 2022', description: 'As onze personagens citadas no início da terceira geração.', names: ['Frankie Stein', 'Draculaura', 'Clawdeen Wolf', 'Cleo de Nile', 'Lagoona Blue', 'Deuce Gorgon', 'Ghoulia Yelps', 'Toralei Stripe', 'Twyla', 'Abbey Bominable', 'Heath Burns'] },
];

const generationNav = document.querySelector('#generationNav');
const collectionNav = document.querySelector('#collectionNav');
const ownedGrid = document.querySelector('#ownedGrid');
const missingList = document.querySelector('#missingList');
const editorPanel = document.querySelector('#editorPanel');
const workspace = document.querySelector('#workspace');
const dollForm = document.querySelector('#dollForm');
const searchInput = document.querySelector('#searchInput');
const objectUrls = new Map();

let db;
let state;
let selectedGeneration = 'g1';
let selectedCollection = 'g1-wave-2010';
let editingId = null;
let selectedPhoto = null;
let photoWasRemoved = false;
let previewUrl = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readState() {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('catalog');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeState() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(state, 'catalog');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `doll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSeed() {
  const collections = structuredClone(seedCollections);
  const dolls = [];
  for (const collection of collections) {
    for (const [index, name] of collection.names.entries()) {
      dolls.push({
        id: `${collection.id}-${index}`,
        name,
        generation: collection.generation,
        collectionId: collection.id,
        owned: false,
        value: '',
        accessoriesOwned: [],
        accessoriesMissing: [],
        photo: null,
        seeded: true,
      });
    }
  }
  return { collections, dolls };
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function getGeneration(id) { return generations.find((generation) => generation.id === id); }
function getCollection(id) { return state.collections.find((collection) => collection.id === id); }
function getCollectionDolls(id) { return state.dolls.filter((doll) => doll.collectionId === id); }
function formatValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor não informado';
}

function revokeObjectUrls() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}

function photoUrl(doll) {
  if (!doll.photo) return '';
  if (!objectUrls.has(doll.id)) objectUrls.set(doll.id, URL.createObjectURL(doll.photo));
  return objectUrls.get(doll.id);
}

function renderGenerationNav() {
  generationNav.innerHTML = generations.map((generation) => `
    <button class="generation-button" type="button" data-generation="${generation.id}" aria-pressed="${generation.id === selectedGeneration}">
      <span class="generation-tag">${generation.label}</span><span class="generation-name">${escapeHTML(generation.name)}</span>
    </button>`).join('');
  document.querySelector('#generationCrumb').textContent = getGeneration(selectedGeneration).label;
  document.querySelector('#generationEyebrow').textContent = `${getGeneration(selectedGeneration).label} · ${getGeneration(selectedGeneration).period}`;
}

function renderCollectionNav() {
  const collections = state.collections.filter((collection) => collection.generation === selectedGeneration);
  collectionNav.innerHTML = collections.map((collection) => `
    <button class="collection-chip" type="button" data-collection="${collection.id}" aria-pressed="${collection.id === selectedCollection}">${escapeHTML(collection.name)}</button>`).join('')
    + '<button class="collection-chip collection-create" type="button" data-new-collection>＋ Nova coleção</button>';
  if (!collections.some((collection) => collection.id === selectedCollection)) selectedCollection = collections[0]?.id ?? '';
}

function renderCatalog() {
  revokeObjectUrls();
  const collection = getCollection(selectedCollection);
  const gen = getGeneration(selectedGeneration);
  document.querySelector('#collectionTitle').textContent = `${gen.label} · ${gen.name}`;
  document.querySelector('#pageDescription').textContent = `${gen.period} Escolha uma coleção para conferir cada nome e atualizar o seu acervo.`;

  if (!collection) {
    document.querySelector('#selectedCollectionTitle').textContent = 'Nenhuma coleção nesta geração';
    document.querySelector('#selectedCollectionDescription').textContent = 'Adicione uma coleção para começar a catalogar.';
    document.querySelector('#ownedCount').textContent = '0';
    document.querySelector('#missingCount').textContent = '0';
    ownedGrid.replaceChildren();
    missingList.replaceChildren();
    document.querySelector('#ownedSection').hidden = true;
    document.querySelector('#missingSection').hidden = true;
    document.querySelector('#emptyState').hidden = false;
    return;
  }

  const query = searchInput.value.trim().toLocaleLowerCase('pt-BR');
  const dolls = getCollectionDolls(collection.id).filter((doll) => doll.name.toLocaleLowerCase('pt-BR').includes(query));
  const owned = dolls.filter((doll) => doll.owned);
  const missing = dolls.filter((doll) => !doll.owned);
  document.querySelector('#selectedCollectionTitle').textContent = collection.name;
  document.querySelector('#selectedCollectionDescription').textContent = collection.description;
  document.querySelector('#ownedCount').textContent = String(getCollectionDolls(collection.id).filter((doll) => doll.owned).length);
  document.querySelector('#missingCount').textContent = String(getCollectionDolls(collection.id).filter((doll) => !doll.owned).length);
  document.querySelector('#ownedSectionCount').textContent = String(owned.length);
  document.querySelector('#missingSectionCount').textContent = String(missing.length);
  document.querySelector('#ownedSection').hidden = owned.length === 0;
  document.querySelector('#missingSection').hidden = missing.length === 0;
  const sourceHasNoG2Roster = collection.id === 'g2-reboot' && collection.names.length === 0 && getCollectionDolls(collection.id).length === 0;
  document.querySelector('#emptyState').hidden = dolls.length !== 0 || sourceHasNoG2Roster;
  document.querySelector('#missingTitle').textContent = query ? 'Nomes encontrados' : 'Ainda estão na lista';

  ownedGrid.innerHTML = owned.map((doll) => `
    <button class="owned-card" type="button" data-edit="${doll.id}" aria-label="Editar ${escapeHTML(doll.name)}">
      <span class="owned-photo">${doll.photo ? `<img src="${photoUrl(doll)}" alt="Foto de ${escapeHTML(doll.name)}">` : `<span class="photo-placeholder"><span aria-hidden="true">＋</span><small>Adicionar uma foto desta boneca</small></span>`}</span>
      <span class="owned-card-copy"><span class="owned-card-name">${escapeHTML(doll.name)}</span><span class="owned-card-meta"><span>${doll.photo ? 'Foto do acervo' : 'Foto pendente'}</span><strong>${escapeHTML(formatValue(doll.value))}</strong></span></span>
    </button>`).join('');

  missingList.innerHTML = missing.map((doll) => `<li><button class="missing-name" type="button" data-edit="${doll.id}">${escapeHTML(doll.name)}</button></li>`).join('');

  if (sourceHasNoG2Roster) {
    document.querySelector('#missingSection').hidden = false;
    missingList.innerHTML = '<li class="source-note">O texto-base define a G2 como o reboot de 2016, mas não lista nomes de personagens. Adicione os nomes que quiser acompanhar.</li>';
  }
}

function render() {
  renderGenerationNav();
  renderCollectionNav();
  renderCatalog();
}

function fillSelects(generationId, collectionId) {
  const generationSelect = document.querySelector('#dollGeneration');
  generationSelect.innerHTML = generations.map((generation) => `<option value="${generation.id}">${generation.label} · ${escapeHTML(generation.name)}</option>`).join('');
  generationSelect.value = generationId;
  fillCollectionSelect(collectionId);
}

function fillCollectionSelect(selectedId) {
  const generationId = document.querySelector('#dollGeneration').value;
  const select = document.querySelector('#dollCollection');
  const collections = state.collections.filter((collection) => collection.generation === generationId);
  select.innerHTML = collections.map((collection) => `<option value="${collection.id}">${escapeHTML(collection.name)}</option>`).join('');
  select.value = collections.some((collection) => collection.id === selectedId) ? selectedId : collections[0]?.id ?? '';
}

function showEditor(doll = null, { owned = doll?.owned ?? false, newEntry = false } = {}) {
  editingId = doll?.id ?? null;
  selectedPhoto = null;
  photoWasRemoved = false;
  dollForm.reset();
  document.querySelector('#formError').hidden = true;
  document.querySelector('#dollId').value = doll?.id ?? '';
  document.querySelector('#dollName').value = doll?.name ?? '';
  document.querySelector('#dollValue').value = doll?.value ?? '';
  document.querySelector('#accessoriesOwned').value = doll?.accessoriesOwned?.join('\n') ?? '';
  document.querySelector('#accessoriesMissing').value = doll?.accessoriesMissing?.join('\n') ?? '';
  document.querySelector(`input[name="owned"][value="${owned}"]`).checked = true;
  fillSelects(doll?.generation ?? selectedGeneration, doll?.collectionId ?? selectedCollection);
  document.querySelector('#editorTitle').textContent = doll ? doll.name : newEntry ? 'Nova boneca' : 'Adicionar boneca';
  document.querySelector('#editorEyebrow').textContent = doll ? 'DETALHES DO ACERVO' : 'NOVO REGISTRO';
  document.querySelector('#deleteDollButton').hidden = !doll || doll.seeded;
  renderPhotoPreview(doll?.photo ?? null);
  document.querySelector('#removePhotoButton').hidden = !doll?.photo;
  document.querySelector('#ownedDetails').hidden = !owned;
  editorPanel.hidden = false;
  workspace.classList.add('has-editor');
  document.querySelector('#dollName').focus();
}

function closeEditor() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  editorPanel.hidden = true;
  workspace.classList.remove('has-editor');
  editingId = null;
  render();
}

function renderPhotoPreview(photo) {
  const preview = document.querySelector('#photoPreview');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  if (!photo) {
    preview.hidden = true;
    preview.replaceChildren();
    return;
  }
  preview.innerHTML = '<img alt="Prévia da foto selecionada">';
  previewUrl = URL.createObjectURL(photo);
  preview.querySelector('img').src = previewUrl;
  preview.hidden = false;
}

function lines(value) {
  return value.split(/\r?\n/).map((line) => line.trim().slice(0, 120)).filter(Boolean).slice(0, 30);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const tempUrl = URL.createObjectURL(file);
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50000000) throw new Error('A imagem tem dimensões grandes demais para ser processada.');
        const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('O navegador não conseguiu preparar esta imagem.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível preparar esta imagem.')), 'image/jpeg', 0.82);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(tempUrl);
      }
    };
    image.onerror = () => { URL.revokeObjectURL(tempUrl); reject(new Error('O arquivo selecionado não é uma imagem válida.')); };
    image.src = tempUrl;
  });
}

function showFormError(message) {
  const error = document.querySelector('#formError');
  error.textContent = message;
  error.hidden = false;
}

async function handleSubmit(event) {
  event.preventDefault();
  document.querySelector('#formError').hidden = true;
  const generation = document.querySelector('#dollGeneration').value;
  const collectionId = document.querySelector('#dollCollection').value;
  const name = document.querySelector('#dollName').value.trim();
  if (!name) return showFormError('Informe o nome da boneca.');
  const isOwned = document.querySelector('input[name="owned"]:checked').value === 'true';
  const valueInput = document.querySelector('#dollValue').value;
  const value = valueInput === '' ? '' : Number(valueInput);
  if (isOwned && valueInput !== '' && (!Number.isFinite(value) || value < 0)) return showFormError('Informe um valor válido igual ou maior que zero.');
  const duplicate = state.dolls.find((doll) => doll.collectionId === collectionId && doll.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR') && doll.id !== editingId);
  if (!duplicate && !state.collections.some((collection) => collection.id === collectionId)) return showFormError('Selecione uma coleção válida.');
  if (duplicate) return showFormError('Este nome já está nesta coleção.');

  let photo = null;
  try {
    const current = state.dolls.find((doll) => doll.id === editingId);
    photo = photoWasRemoved ? null : selectedPhoto ? await compressImage(selectedPhoto) : current?.photo ?? null;
  } catch (error) {
    return showFormError(error.message || 'Não foi possível salvar a foto.');
  }
  const doll = {
    ...(state.dolls.find((item) => item.id === editingId) ?? {}),
    id: editingId ?? makeId(), name, generation, collectionId, owned: isOwned,
    value: isOwned ? value : '',
    accessoriesOwned: isOwned ? lines(document.querySelector('#accessoriesOwned').value) : [],
    accessoriesMissing: isOwned ? lines(document.querySelector('#accessoriesMissing').value) : [],
    photo: isOwned ? photo : null,
    seeded: state.dolls.find((item) => item.id === editingId)?.seeded ?? false,
  };
  const previousDolls = [...state.dolls];
  if (editingId) state.dolls = state.dolls.map((item) => item.id === editingId ? doll : item);
  else state.dolls.push(doll);
  try {
    await writeState();
    selectedGeneration = generation;
    selectedCollection = collectionId;
    closeEditor();
  } catch {
    state.dolls = previousDolls;
    showFormError('Não foi possível salvar. O armazenamento do navegador pode estar indisponível.');
  }
}

async function addCollection() {
  const name = prompt(`Nome da nova coleção em ${getGeneration(selectedGeneration).label}:`)?.trim();
  if (!name) return;
  const duplicate = state.collections.some((collection) => collection.generation === selectedGeneration && collection.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
  if (duplicate) return alert('Já existe uma coleção com esse nome nesta geração.');
  const collection = { id: makeId(), generation: selectedGeneration, name, description: 'Coleção adicionada ao seu arquivo.', names: [] };
  const previousCollection = selectedCollection;
  state.collections.push(collection);
  selectedCollection = collection.id;
  try {
    await writeState();
    render();
  } catch {
    state.collections = state.collections.filter((item) => item.id !== collection.id);
    selectedCollection = previousCollection;
    alert('Não foi possível salvar a coleção.');
    render();
  }
}

async function deleteDoll() {
  if (!editingId) return;
  if (!confirm('Excluir esta boneca do catálogo? Esta ação não pode ser desfeita.')) return;
  const previousDolls = [...state.dolls];
  state.dolls = state.dolls.filter((doll) => doll.id !== editingId);
  try {
    await writeState();
    closeEditor();
  } catch {
    state.dolls = previousDolls;
    showFormError('Não foi possível excluir este registro.');
  }
}

async function exportBackup() {
  const backup = {
    version: 1,
    createdAt: new Date().toISOString(),
    collections: state.collections,
    dolls: state.dolls,
  };
  const readerTasks = state.dolls.map((doll) => new Promise((resolve, reject) => {
    if (!doll.photo) return resolve([doll.id, null]);
    const reader = new FileReader();
    reader.onload = () => resolve([doll.id, reader.result]);
    reader.onerror = () => reject(new Error('Não foi possível ler uma das fotos.'));
    reader.readAsDataURL(doll.photo);
  }));
  try {
    const photos = await Promise.all(readerTasks);
    const photoMap = Object.fromEntries(photos);
    backup.dolls = backup.dolls.map(({ photo, ...doll }) => ({ ...doll, photo: photoMap[doll.id] }));
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meu-arquivo-monster-high-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    alert(error.message || 'Não foi possível preparar o backup completo. Tente novamente.');
  }
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
  const [header, encoded] = dataUrl.split(',');
  const mime = header.match(/^data:(image\/[\w.+-]+);base64$/)?.[1];
  if (!mime || !encoded) return null;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function restoreBackup(file) {
  try {
    if (file.size > 50 * 1024 * 1024) throw new Error('O arquivo de backup excede 50 MB.');
    const backup = JSON.parse(await file.text());
    if (backup.version !== 1 || !Array.isArray(backup.collections) || !Array.isArray(backup.dolls)) throw new Error('Este arquivo não parece ser um backup compatível.');
    if (backup.collections.length > 500 || backup.dolls.length > 5000) throw new Error('O backup contém mais registros do que o app consegue importar de uma vez.');
    const collectionIds = new Set(backup.collections.map((collection) => collection.id));
    const collections = backup.collections.filter((collection) => typeof collection.id === 'string' && typeof collection.name === 'string' && collection.name.length <= 100 && generations.some((generation) => generation.id === collection.generation));
    if (collections.length !== backup.collections.length) throw new Error('O backup contém uma coleção inválida.');
    const dolls = backup.dolls.map((doll) => {
      const collection = backup.collections.find((item) => item.id === doll.collectionId);
      const value = doll.value === '' || doll.value == null ? '' : Number(doll.value);
      if (typeof doll.id !== 'string' || typeof doll.name !== 'string' || !doll.name.trim() || doll.name.length > 80 || !collectionIds.has(doll.collectionId) || collection?.generation !== doll.generation || !generations.some((generation) => generation.id === doll.generation) || typeof doll.owned !== 'boolean' || (value !== '' && (!Number.isFinite(value) || value < 0))) throw new Error('O backup contém um registro de boneca inválido.');
      return { ...doll, photo: dataUrlToBlob(doll.photo), value, accessoriesOwned: Array.isArray(doll.accessoriesOwned) ? doll.accessoriesOwned.filter((item) => typeof item === 'string').map((item) => item.slice(0, 120)).slice(0, 30) : [], accessoriesMissing: Array.isArray(doll.accessoriesMissing) ? doll.accessoriesMissing.filter((item) => typeof item === 'string').map((item) => item.slice(0, 120)).slice(0, 30) : [] };
    });
    if (!confirm('Restaurar este arquivo substituirá o acervo atual neste navegador. Faça um backup antes se quiser manter os dois. Continuar?')) return;
    const previousState = state;
    const previousGeneration = selectedGeneration;
    const previousCollection = selectedCollection;
    state = { collections, dolls };
    selectedGeneration = 'g1';
    selectedCollection = collections.find((collection) => collection.generation === selectedGeneration)?.id ?? collections[0]?.id ?? '';
    try {
      await writeState();
    } catch (error) {
      state = previousState;
      selectedGeneration = previousGeneration;
      selectedCollection = previousCollection;
      throw error;
    }
    render();
    closeEditor();
  } catch (error) {
    alert(error.message || 'Não foi possível importar o backup.');
  }
}

function addSeededName() {
  document.querySelector('#dollName').placeholder = 'Nome da boneca';
  showEditor(null, { owned: false, newEntry: true });
}

generationNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-generation]');
  if (!button) return;
  selectedGeneration = button.dataset.generation;
  selectedCollection = state.collections.find((collection) => collection.generation === selectedGeneration)?.id ?? '';
  render();
});
collectionNav.addEventListener('click', (event) => {
  if (event.target.closest('[data-new-collection]')) return addCollection();
  const button = event.target.closest('[data-collection]');
  if (!button) return;
  selectedCollection = button.dataset.collection;
  render();
});
document.querySelector('#addDollButton').addEventListener('click', () => showEditor(null, { owned: true, newEntry: true }));
document.querySelector('#emptyAddButton').addEventListener('click', () => showEditor(null, { owned: false, newEntry: true }));
document.querySelector('#editCollectionButton').addEventListener('click', addSeededName);
document.querySelector('#closeEditorButton').addEventListener('click', closeEditor);
document.querySelector('#deleteDollButton').addEventListener('click', deleteDoll);
dollForm.addEventListener('submit', handleSubmit);
searchInput.addEventListener('input', renderCatalog);
document.querySelector('#dollGeneration').addEventListener('change', () => fillCollectionSelect(''));
document.querySelectorAll('input[name="owned"]').forEach((input) => input.addEventListener('change', () => {
  const owned = document.querySelector('input[name="owned"]:checked').value === 'true';
  document.querySelector('#ownedDetails').hidden = !owned;
}));
document.querySelector('#dollPhoto').addEventListener('change', (event) => {
  selectedPhoto = event.target.files?.[0] ?? null;
  photoWasRemoved = false;
  if (!selectedPhoto) return;
  if (!selectedPhoto.type.startsWith('image/')) {
    event.target.value = '';
    selectedPhoto = null;
    return showFormError('Escolha um arquivo de imagem.');
  }
  if (selectedPhoto.size > 15 * 1024 * 1024) {
    event.target.value = '';
    selectedPhoto = null;
    return showFormError('A foto deve ter no máximo 15 MB.');
  }
  document.querySelector('#formError').hidden = true;
  renderPhotoPreview(selectedPhoto);
  document.querySelector('#removePhotoButton').hidden = false;
});
document.querySelector('#removePhotoButton').addEventListener('click', () => {
  selectedPhoto = null;
  photoWasRemoved = true;
  document.querySelector('#dollPhoto').value = '';
  document.querySelector('#removePhotoButton').hidden = true;
  renderPhotoPreview(null);
});
document.querySelector('#backupButton').addEventListener('click', exportBackup);
document.querySelector('#restoreButton').addEventListener('click', () => document.querySelector('#restoreInput').click());
document.querySelector('#restoreInput').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) restoreBackup(file);
  event.target.value = '';
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && !editorPanel.hidden) closeEditor();
});

async function init() {
  try {
    db = await openDatabase();
    const stored = await readState();
    if (stored == null) {
      state = buildSeed();
      await writeState();
    } else if (Array.isArray(stored.collections) && Array.isArray(stored.dolls)) {
      state = stored;
    } else {
      throw new Error('O arquivo salvo está incompleto.');
    }
    render();
  } catch {
    document.querySelector('.main-content').innerHTML = '<section class="storage-error"><h1>Não consegui abrir seu arquivo</h1><p>Este navegador não disponibilizou o armazenamento local. Abra o app em um navegador compatível e tente novamente.</p></section>';
  }
}

init();

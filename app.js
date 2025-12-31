// Variables globales
let productosData = [];
let uniqueProducts = [];
let supermarkets = new Set();
let cities = new Set();
let brands = new Set();
let availableYears = new Set();
let currentChart = null;
let currentProductData = null;
let currentSearchTerm = '';
let currentFilters = {
    city: 'global',
    supermarket: 'global',
    brand: 'global'
};

// Elementos DOM
const screens = {
    main: document.getElementById('main-screen'),
    results: document.getElementById('results-screen'),
    variation: document.getElementById('variation-screen'),
    inflation: document.getElementById('inflation-screen'),
    top: document.getElementById('top-screen'),
    filter: document.getElementById('filter-screen')
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicación...');
    await loadData();
    initEventListeners();
    setupSearch();
});

// Cargar datos
async function loadData() {
    showLoading();
    
    try {
        console.log('📂 Cargando datos...');
        const response = await fetch('./datos_super.json');
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}`);
        }
        
        productosData = await response.json();
        console.log(`✅ ${productosData.length} registros cargados`);
        
        // Procesar datos
        processData();
        updateStats();
        
        // Actualizar fecha
        const now = new Date();
        document.getElementById('last-update').textContent = 
            now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
            
    } catch (error) {
        console.error('❌ Error:', error);
        showError(`Error cargando datos: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Procesar datos
function processData() {
    // Productos únicos
    uniqueProducts = [...new Set(productosData.map(p => p.producto))].sort();
    
    // Supermercados
    supermarkets = new Set(productosData.map(p => p.super).filter(Boolean));
    
    // Ciudades
    cities = new Set(productosData.map(p => p.ciudad).filter(Boolean));
    
    // Marcas
    brands = new Set(productosData.map(p => p.marca).filter(Boolean));
    
    // Años disponibles dinámicamente
    availableYears.clear();
    productosData.forEach(item => {
        // Buscar campos de variación por año dinámicamente
        for (const key in item) {
            if (key.startsWith('variacion_') && key !== 'variacion_total') {
                const year = key.replace('variacion_', '');
                if (!isNaN(year) && item[key] !== null && item[key] !== undefined) {
                    availableYears.add(year);
                }
            }
        }
    });
    
    console.log(`📊 ${uniqueProducts.length} productos únicos`);
    console.log(`🏪 ${supermarkets.size} supermercados`);
    console.log(`🏙️ ${cities.size} ciudades`);
    console.log(`🏷️ ${brands.size} marcas`);
    console.log(`📅 Años disponibles:`, Array.from(availableYears).sort());
}

// Actualizar estadísticas
function updateStats() {
    // Actualizar contadores principales
    document.getElementById('total-products').textContent = uniqueProducts.length;
    document.getElementById('total-supermarkets').textContent = supermarkets.size;
    document.getElementById('total-cities').textContent = cities.size;
    document.getElementById('total-records').textContent = productosData.length;
    document.getElementById('footer-total-data').textContent = productosData.length;
    
    // Calcular rango de fechas
    const fechas = productosData
        .map(p => new Date(p.fecha))
        .filter(date => !isNaN(date.getTime()));
    
    if (fechas.length > 0) {
        const minDate = new Date(Math.min(...fechas));
        const maxDate = new Date(Math.max(...fechas));
        document.getElementById('date-range').textContent = 
            `${minDate.toLocaleDateString('es-ES')} - ${maxDate.toLocaleDateString('es-ES')}`;
    }
}

// Configurar búsqueda
function setupSearch() {
    const searchInput = document.getElementById('product-search');
    const searchBtn = document.getElementById('search-btn');
    const suggestions = document.getElementById('suggestions');
    
    // Buscar al hacer clic
    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            searchProduct(query);
        }
    });
    
    // Buscar con Enter
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                searchProduct(query);
            }
        }
    });
    
    // Autocompletado
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        suggestions.innerHTML = '';
        
        if (query.length < 2) return;
        
        const matches = uniqueProducts
            .filter(product => product.toLowerCase().includes(query))
            .slice(0, 8);
        
        matches.forEach(product => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = product;
            div.addEventListener('click', () => {
                searchInput.value = product;
                suggestions.innerHTML = '';
                searchProduct(product);
            });
            suggestions.appendChild(div);
        });
    });
    
    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.innerHTML = '';
        }
    });
}

// Buscar producto
function searchProduct(productName) {
    const query = productName.toLowerCase().trim();
    if (!query) return;
    
    console.log('🔍 Buscando:', query);
    currentSearchTerm = query;
    showLoading();
    
    try {
        // Buscar coincidencias EXACTAS
        const exactMatches = productosData.filter(p => 
            p.producto && p.producto.toLowerCase() === query
        );
        
        console.log('📊 Resultados exactos encontrados:', exactMatches.length);
        
        if (exactMatches.length === 0) {
            const startsWithMatches = productosData.filter(p => 
                p.producto && p.producto.toLowerCase().startsWith(query + ' ')
            );
            
            if (startsWithMatches.length > 0) {
                const suggestedProducts = [...new Set(startsWithMatches.map(p => p.producto))].slice(0, 3);
                showError(`Producto no encontrado. ¿Quizás quisiste decir: ${suggestedProducts.join(', ')}?`);
                hideLoading();
                return;
            } else {
                showError('Producto no encontrado');
                hideLoading();
                return;
            }
        }
        
        // Guardar datos actuales para el filtro
        currentProductData = exactMatches;
        
        // Ordenar por fecha
        exactMatches.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Actualizar título
        const titleElem = document.getElementById('product-title');
        if (titleElem) {
            titleElem.textContent = exactMatches[0].producto;
        }
        
        // Resetear filtros
        currentFilters = {
            city: 'global',
            supermarket: 'global',
            brand: 'global'
        };
        
        // Mostrar resumen
        updateProductSummary(exactMatches, currentFilters);
        
        // Crear gráfico
        const { ciudades, supermercados, marcas } = createPriceChart(exactMatches, currentFilters);
        
        // Configurar filtros
        setupFilters(exactMatches, ciudades, supermercados, marcas);
        
        // Mostrar detalles
        showBrandDetails(exactMatches);
        
        // Cambiar pantalla
        showScreen('results');
        
        console.log('✅ Producto mostrado correctamente');
        
    } catch (error) {
        console.error('❌ Error en searchProduct:', error);
        showError('Error al mostrar el producto: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Actualizar resumen del producto (CAMBIADO: variación media en lugar de total)
function updateProductSummary(productData, filters = { city: 'global', supermarket: 'global', brand: 'global' }) {
    if (!productData || productData.length === 0) return;
    
    // Aplicar filtros a los datos
    let filteredData = productData;
    
    if (filters.city !== 'global') {
        filteredData = filteredData.filter(item => item.ciudad === filters.city);
    }
    
    if (filters.supermarket !== 'global') {
        filteredData = filteredData.filter(item => item.super === filters.supermarket);
    }
    
    if (filters.brand !== 'global') {
        filteredData = filteredData.filter(item => item.marca === filters.brand);
    }
    
    if (filteredData.length === 0) {
        document.getElementById('current-price').textContent = '-';
        document.getElementById('total-variation').textContent = '-';
        document.getElementById('total-records-result').textContent = '0';
        document.getElementById('last-record-date').textContent = '-';
        
        document.getElementById('current-price-context').textContent = 'Sin datos con filtros';
        document.getElementById('variation-context').textContent = 'Sin datos con filtros';
        document.getElementById('records-context').textContent = 'Sin datos con filtros';
        document.getElementById('date-context').textContent = 'Sin datos con filtros';
        return;
    }
    
    // Ordenar por fecha
    filteredData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    // PRECIO ACTUAL
    const mostRecentRecord = filteredData[0];
    const currentPrice = mostRecentRecord.precio || 0;
    document.getElementById('current-price').textContent = `${currentPrice.toFixed(2)}€`;
    
    // VARIACIÓN MEDIA (NUEVO CÁLCULO)
    const groupedVariations = new Map();
    
    filteredData.forEach(item => {
        if (!item.super || !item.marca) return;
        
        const key = `${item.producto}||${item.marca}||${item.super}`;
        
        if (item.variacion_total !== null && item.variacion_total !== undefined && !isNaN(item.variacion_total)) {
            if (!groupedVariations.has(key)) {
                groupedVariations.set(key, {
                    count: 1,
                    total: item.variacion_total
                });
            } else {
                const existing = groupedVariations.get(key);
                groupedVariations.set(key, {
                    count: existing.count + 1,
                    total: existing.total + item.variacion_total
                });
            }
        }
    });
    
    let avgVariation = 0;
    if (groupedVariations.size > 0) {
        let totalVariation = 0;
        let totalGroups = 0;
        
        groupedVariations.forEach(variation => {
            totalVariation += variation.total / variation.count;
            totalGroups++;
        });
        
        avgVariation = totalVariation / totalGroups;
    }
    
    const variationElem = document.getElementById('total-variation');
    variationElem.textContent = `${avgVariation >= 0 ? '+' : ''}${avgVariation.toFixed(1)}%`;
    variationElem.className = `variation-large ${avgVariation >= 0 ? 'positive' : 'negative'}`;
    
    // Registros
    document.getElementById('total-records-result').textContent = filteredData.length;
    
    // Última fecha
    if (document.getElementById('last-record-date')) {
        const lastDate = new Date(mostRecentRecord.fecha);
        document.getElementById('last-record-date').textContent = lastDate.toLocaleDateString('es-ES');
    }
    
    // Actualizar contextos según filtros
    let contextText = '';
    const activeFilters = [];
    
    if (filters.city !== 'global') activeFilters.push(`Ciudad: ${filters.city}`);
    if (filters.supermarket !== 'global') activeFilters.push(`Super: ${filters.supermarket}`);
    if (filters.brand !== 'global') activeFilters.push(`Marca: ${filters.brand}`);
    
    if (activeFilters.length === 0) {
        contextText = 'Todos los datos';
    } else {
        contextText = activeFilters.join(' | ');
    }
    
    document.getElementById('current-price-context').textContent = contextText;
    document.getElementById('variation-context').textContent = contextText;
    document.getElementById('records-context').textContent = contextText;
    document.getElementById('date-context').textContent = contextText;
}

// Crear gráfico de precios
function createPriceChart(productData, filters = { city: 'global', supermarket: 'global', brand: 'global' }) {
    console.log('📈 Creando gráfico (Marca + Supermercado)');
    
    const canvas = document.getElementById('price-chart');
    if (!canvas) {
        console.error('❌ Canvas no encontrado');
        return { ciudades: [], supermercados: [], marcas: [] };
    }
    
    // Limpiar mensajes de error previos
    const chartContainer = canvas.parentElement.parentElement;
    const existingError = chartContainer.querySelector('.chart-info-message');
    if (existingError) existingError.remove();
    
    // Destruir gráfico anterior
    if (currentChart instanceof Chart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    try {
        // Aplicar filtros a los datos
        let filteredData = productData;
        
        if (filters.city !== 'global') {
            filteredData = filteredData.filter(item => item.ciudad === filters.city);
        }
        
        if (filters.supermarket !== 'global') {
            filteredData = filteredData.filter(item => item.super === filters.supermarket);
        }
        
        if (filters.brand !== 'global') {
            filteredData = filteredData.filter(item => item.marca === filters.brand);
        }
        
        console.log(`🌍 Datos después de filtros:`, filteredData.length, 'registros');
        
        if (!filteredData || filteredData.length === 0) {
            const ctx = canvas.getContext('2d');
            currentChart = new Chart(ctx, {
                type: 'line',
                data: { datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { type: 'time', title: { display: true, text: 'Fecha' } },
                        y: { title: { display: true, text: 'Precio (€)' } }
                    }
                }
            });
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'chart-info-message';
            infoDiv.innerHTML = `<p><i class="fas fa-info-circle"></i> No hay datos disponibles con los filtros actuales</p>`;
            chartContainer.appendChild(infoDiv);
            
            return { ciudades: [], supermercados: [], marcas: [] };
        }
        
        // Agrupar por MARCA + SUPERMERCADO
        const groups = {};
        const ciudadesDisponibles = new Set();
        const supermercadosDisponibles = new Set();
        const marcasDisponibles = new Set();
        
        filteredData.forEach(item => {
            if (!item || !item.super) return;
            
            if (item.ciudad) {
                ciudadesDisponibles.add(item.ciudad);
            }
            if (item.super) {
                supermercadosDisponibles.add(item.super);
            }
            if (item.marca) {
                marcasDisponibles.add(item.marca);
            }
            
            const marca = item.marca || 'Sin marca';
            const key = `${marca} | ${item.super}`;
            
            if (!groups[key]) {
                groups[key] = {
                    marca: marca,
                    super: item.super,
                    datos: []
                };
            }
            
            const fecha = new Date(item.fecha);
            if (isNaN(fecha.getTime())) {
                console.warn('Fecha inválida:', item.fecha);
                return;
            }
            
            const precio = item.precio_neto !== undefined ? item.precio_neto : item.precio;
            if (typeof precio !== 'number' || isNaN(precio)) {
                console.warn('Precio inválido:', precio);
                return;
            }
            
            groups[key].datos.push({
                fecha: fecha,
                precio: precio,
                ciudad: item.ciudad || 'Desconocida',
                precio_neto: item.precio_neto
            });
        });
        
        console.log('Combinaciones encontradas (Marca + Super):', Object.keys(groups).length);
        
        // Ordenar cada grupo por fecha
        const validGroups = {};
        for (const [key, group] of Object.entries(groups)) {
            if (group.datos.length > 0) {
                group.datos.sort((a, b) => a.fecha - b.fecha);
                validGroups[key] = group;
            }
        }
        
        // Si no hay grupos válidos
        if (Object.keys(validGroups).length === 0) {
            const ctx = canvas.getContext('2d');
            currentChart = new Chart(ctx, {
                type: 'line',
                data: { datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { type: 'time', title: { display: true, text: 'Fecha' } },
                        y: { title: { display: true, text: 'Precio (€)' } }
                    }
                }
            });
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'chart-info-message';
            infoDiv.innerHTML = '<p><i class="fas fa-info-circle"></i> No hay suficientes datos para mostrar líneas en el gráfico</p>';
            chartContainer.appendChild(infoDiv);
            
            return { 
                ciudades: Array.from(ciudadesDisponibles), 
                supermercados: Array.from(supermercadosDisponibles),
                marcas: Array.from(marcasDisponibles)
            };
        }
        
        // Preparar datasets para Chart.js
        const datasets = [];
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F1948A', '#76D7C4', '#F8C471', '#AF7AC5', '#82E0AA',
            '#F9E79F', '#D7BDE2', '#85C1E9', '#F5B7B1', '#AED6F1'
        ];
        
        Object.entries(validGroups).forEach(([combinacion, group], index) => {
            const { marca, super: supermercado, datos } = group;
            
            let label = `${marca} (${supermercado})`;
            
            if (datos.length >= 2) {
                const firstPrice = datos[0].precio;
                const lastPrice = datos[datos.length - 1].precio;
                if (firstPrice > 0) {
                    const variacion = ((lastPrice - firstPrice) / firstPrice) * 100;
                    label = `${marca} (${supermercado}) ${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%`;
                }
            }
            
            const datasetConfig = {
                label: label,
                data: datos.map(d => ({
                    x: d.fecha,
                    y: d.precio
                })),
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: datos.length >= 2 ? 2 : 0,
                tension: 0.2,
                fill: false,
                pointRadius: datos.length === 1 ? 6 : 4,
                pointHoverRadius: datos.length === 1 ? 10 : 6,
                pointBackgroundColor: colors[index % colors.length],
                pointBorderColor: '#fff',
                pointBorderWidth: 1,
                showLine: datos.length >= 2
            };
            
            datasets.push(datasetConfig);
        });
        
        console.log('Datasets preparados:', datasets.length);
        
        // Obtener contexto del canvas
        const ctx = canvas.getContext('2d');
        
        // Configuración del gráfico
        const config = {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 11
                            },
                            padding: 8,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const precio = context.parsed.y;
                                const fecha = new Date(context.parsed.x);
                                return `${precio.toFixed(2)}€ (${fecha.toLocaleDateString('es-ES')})`;
                            },
                            title: function(context) {
                                const label = context[0].dataset.label || '';
                                return label.split(' ').slice(0, -1).join(' ');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            displayFormats: {
                                month: 'MMM yyyy'
                            },
                            tooltipFormat: 'dd/MM/yyyy'
                        },
                        title: {
                            display: true,
                            text: 'Fecha',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Precio (€)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2) + '€';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                }
            }
        };
        
        // Crear el gráfico
        currentChart = new Chart(ctx, config);
        
        console.log('✅ Gráfico creado exitosamente');
        
        return { 
            ciudades: Array.from(ciudadesDisponibles), 
            supermercados: Array.from(supermercadosDisponibles),
            marcas: Array.from(marcasDisponibles)
        };
        
    } catch (error) {
        console.error('❌ Error al crear gráfico:', error);
        
        const ctx = canvas.getContext('2d');
        currentChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', title: { display: true, text: 'Fecha' } },
                    y: { title: { display: true, text: 'Precio (€)' } }
                }
            }
        });
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chart-info-message';
        errorDiv.innerHTML = `
            <p><i class="fas fa-info-circle"></i> ${error.message}</p>
            <p><small>Intenta buscar otro producto o cambiar los filtros</small></p>
        `;
        chartContainer.appendChild(errorDiv);
        
        return { ciudades: [], supermercados: [], marcas: [] };
    }
}

// Configurar selectores de filtros
function setupFilters(productData, ciudades, supermercados, marcas) {
    const citySelect = document.getElementById('city-filter');
    const supermarketSelect = document.getElementById('supermarket-filter');
    const brandSelect = document.getElementById('brand-filter');
    const applyBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filter');
    
    if (!citySelect || !supermarketSelect || !brandSelect || !applyBtn || !resetBtn) return;
    
    // Actualizar selectores
    updateFilterSelector(citySelect, ciudades, currentFilters.city);
    updateFilterSelector(supermarketSelect, supermercados, currentFilters.supermarket);
    updateFilterSelector(brandSelect, marcas, currentFilters.brand);
    
    // Al aplicar filtros
    applyBtn.addEventListener('click', function() {
        const selectedCity = citySelect.value;
        const selectedSupermarket = supermarketSelect.value;
        const selectedBrand = brandSelect.value;
        
        currentFilters = {
            city: selectedCity,
            supermarket: selectedSupermarket,
            brand: selectedBrand
        };
        
        console.log(`🌍 Aplicando filtros: Ciudad=${selectedCity}, Supermercado=${selectedSupermarket}, Marca=${selectedBrand}`);
        
        showLoading();
        setTimeout(() => {
            updateProductSummary(productData, currentFilters);
            createPriceChart(productData, currentFilters);
            showBrandDetails(productData, currentFilters);
            hideLoading();
        }, 100);
    });
    
    // Al restablecer
    resetBtn.addEventListener('click', function() {
        citySelect.value = 'global';
        supermarketSelect.value = 'global';
        brandSelect.value = 'global';
        currentFilters = { city: 'global', supermarket: 'global', brand: 'global' };
        
        console.log('🔄 Restableciendo filtros');
        
        showLoading();
        setTimeout(() => {
            updateProductSummary(productData, currentFilters);
            createPriceChart(productData, currentFilters);
            showBrandDetails(productData, currentFilters);
            hideLoading();
        }, 100);
    });
}

// Actualizar selector de filtros
function updateFilterSelector(selectElement, options, selectedValue) {
    if (!selectElement) return;
    
    const currentValue = selectElement.value;
    
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    options.sort();
    
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        selectElement.appendChild(opt);
    });
    
    if (options.includes(currentValue)) {
        selectElement.value = currentValue;
    } else {
        selectElement.value = selectedValue;
    }
}

// Mostrar detalles por marca/supermercado
function showBrandDetails(productData, filters = { city: 'global', supermarket: 'global', brand: 'global' }) {
    const container = document.getElementById('brand-details');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!productData || productData.length === 0) {
        container.innerHTML = '<p class="no-data">No hay datos de detalles</p>';
        return;
    }
    
    // Aplicar filtros a los datos
    let filteredData = productData;
    
    if (filters.city !== 'global') {
        filteredData = filteredData.filter(item => item.ciudad === filters.city);
    }
    
    if (filters.supermarket !== 'global') {
        filteredData = filteredData.filter(item => item.super === filters.supermarket);
    }
    
    if (filters.brand !== 'global') {
        filteredData = filteredData.filter(item => item.marca === filters.brand);
    }
    
    if (filteredData.length === 0) {
        container.innerHTML = '<p class="no-data">No hay datos con los filtros aplicados</p>';
        return;
    }
    
    // Agrupar por MARCA + SUPERMERCADO
    const groups = {};
    filteredData.forEach(item => {
        if (!item || !item.super) return;
        
        const marca = item.marca || 'Sin marca';
        const key = `${marca} | ${item.super}`;
        
        if (!groups[key]) {
            groups[key] = {
                marca: marca,
                super: item.super,
                datos: []
            };
        }
        
        groups[key].datos.push(item);
    });
    
    console.log('Grupos para detalles (Marca + Super):', Object.keys(groups).length);
    
    // Crear tarjetas para cada grupo
    Object.entries(groups).forEach(([combinacion, group]) => {
        if (group.datos.length === 0) return;
        
        group.datos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        
        const firstItem = group.datos[0];
        const lastItem = group.datos[group.datos.length - 1];
        
        const firstPrice = firstItem.precio_neto !== undefined ? firstItem.precio_neto : firstItem.precio;
        const lastPrice = lastItem.precio_neto !== undefined ? lastItem.precio_neto : lastItem.precio;
        
        let variacion = 0;
        let variacionTexto = 'N/A';
        if (firstPrice > 0 && typeof firstPrice === 'number') {
            variacion = ((lastPrice - firstPrice) / firstPrice) * 100;
            variacionTexto = `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%`;
        }
        
        const precioPromedio = group.datos.reduce((sum, item) => {
            const precio = item.precio_neto !== undefined ? item.precio_neto : item.precio;
            return sum + precio;
        }, 0) / group.datos.length;
        
        const card = document.createElement('div');
        card.className = 'brand-card';
        card.innerHTML = `
            <div class="brand-header">
                <h4>${group.marca}</h4>
                <span class="super-badge">${group.super}</span>
            </div>
            <div class="brand-info">
                <div>
                    <small>Primer precio neto</small>
                    <p>${firstPrice.toFixed(2)}€</p>
                    <small class="date">${new Date(firstItem.fecha).toLocaleDateString('es-ES')}</small>
                </div>
                <div>
                    <small>Último precio neto</small>
                    <p>${lastPrice.toFixed(2)}€</p>
                    <small class="date">${new Date(lastItem.fecha).toLocaleDateString('es-ES')}</small>
                </div>
                <div>
                    <small>Variación</small>
                    <p class="${variacion >= 0 ? 'positive' : 'negative'}">${variacionTexto}</p>
                </div>
                <div>
                    <small>Promedio neto</small>
                    <p>${precioPromedio.toFixed(2)}€</p>
                </div>
            </div>
            <div class="brand-meta">
                <span><i class="fas fa-database"></i> ${group.datos.length} registros</span>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    if (container.innerHTML === '') {
        container.innerHTML = '<p class="no-data">No hay datos agrupados con los filtros actuales</p>';
    }
}

// Mostrar análisis de variación
function showVariationAnalysis() {
    showScreen('variation');
    
    // Configurar event listeners para los botones grandes
    document.querySelectorAll('#variation-screen .variation-option').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            if (action === 'top-increases') {
                showTopVariations('increases');
            } else if (action === 'top-decreases') {
                showTopVariations('decreases');
            }
        });
    });
}

// Mostrar top productos con variación (PRODUCTO + MARCA + SUPER)
function showTopVariations(type) {
    showLoading();
    
    // Agrupar por producto, marca y supermercado, tomando el MÁS RECIENTE de cada uno
    const latestProducts = new Map();
    
    productosData.forEach(item => {
        if (!item.producto || !item.super) return;
        
        const key = `${item.producto}||${item.marca || 'Sin marca'}||${item.super}`;
        const currentDate = new Date(item.fecha);
        
        if (!latestProducts.has(key) || currentDate > latestProducts.get(key).fecha) {
            latestProducts.set(key, {
                fecha: currentDate,
                producto: item.producto,
                marca: item.marca || 'Sin marca',
                super: item.super,
                variacion_total: item.variacion_total || 0
            });
        }
    });
    
    // Convertir a array y filtrar productos con variación
    const productsWithVariation = Array.from(latestProducts.values())
        .filter(item => item.variacion_total !== null && item.variacion_total !== 0);
    
    // Ordenar
    if (type === 'increases') {
        productsWithVariation.sort((a, b) => b.variacion_total - a.variacion_total);
        document.querySelector('#variation-screen .screen-title h2').textContent = 'Mayores Subidas';
    } else {
        productsWithVariation.sort((a, b) => a.variacion_total - b.variacion_total);
        document.querySelector('#variation-screen .screen-title h2').textContent = 'Mayores Bajadas';
    }
    
    // Mostrar top 15
    const containerId = type === 'increases' ? 'top-increases' : 'top-decreases';
    const container = document.getElementById(containerId);
    const otherContainerId = type === 'increases' ? 'top-decreases' : 'top-increases';
    const otherContainer = document.getElementById(otherContainerId);
    
    if (container && otherContainer) {
        container.classList.remove('hidden');
        otherContainer.classList.add('hidden');
    }
    
    if (container) {
        container.innerHTML = '';
        
        const topItems = productsWithVariation.slice(0, 15);
        
        if (topItems.length === 0) {
            container.innerHTML = '<p class="no-data">No hay datos suficientes</p>';
        } else {
            topItems.forEach((item, index) => {
                const itemElement = document.createElement('div');
                itemElement.className = 'top-item';
                itemElement.innerHTML = `
                    <div class="top-rank">${index + 1}</div>
                    <div class="top-info">
                        <h4>${item.producto}</h4>
                        <div class="product-details">
                            <span><i class="fas fa-tag"></i> ${item.marca}</span>
                            <span><i class="fas fa-store"></i> ${item.super}</span>
                        </div>
                        <div class="top-stats">
                            <span>Variación total</span>
                            <span class="${item.variacion_total >= 0 ? 'positive' : 'negative'}">
                                ${item.variacion_total >= 0 ? '+' : ''}${item.variacion_total.toFixed(1)}%
                            </span>
                        </div>
                        <small>Última actualización: ${new Date(item.fecha).toLocaleDateString('es-ES')}</small>
                    </div>
                    <button class="view-btn" onclick="searchProduct('${item.producto.replace(/'/g, "\\'")}')">
                        <i class="fas fa-chart-line"></i>
                    </button>
                `;
                container.appendChild(itemElement);
            });
        }
    }
    
    // Activar tab correspondiente
    document.querySelectorAll('#variation-screen .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === type) {
            btn.classList.add('active');
        }
    });
    
    hideLoading();
}

// Mostrar análisis de inflación (CÁLCULO CORREGIDO - EQUIVALENTE AL PYTHON)
function showInflationAnalysis() {
    showScreen('inflation');
    updateInflationStats();
    
    // Configurar event listeners para filtros
    const cityFilter = document.getElementById('city-inflation-filter');
    const yearFilter = document.getElementById('year-inflation-filter');
    
    if (cityFilter) {
        updateFilterSelector(cityFilter, Array.from(cities), 'global');
        cityFilter.addEventListener('change', updateInflationStats);
    }
    
    if (yearFilter) {
        // Limpiar opciones existentes
        while (yearFilter.options.length > 1) {
            yearFilter.remove(1);
        }
        
        // Añadir opción para cada año disponible dinámicamente
        const sortedYears = Array.from(availableYears).sort();
        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `Año ${year}`;
            yearFilter.appendChild(option);
        });
        
        yearFilter.addEventListener('change', updateInflationStats);
    }
}

// Actualizar estadísticas de inflación (NUEVO CÁLCULO - EQUIVALENTE AL PYTHON)
function updateInflationStats() {
    const cityFilter = document.getElementById('city-inflation-filter');
    const yearFilter = document.getElementById('year-inflation-filter');
    const statsContainer = document.getElementById('inflation-stats');
    
    if (!cityFilter || !yearFilter || !statsContainer) return;
    
    const selectedCity = cityFilter.value;
    const selectedYear = yearFilter.value;
    
    // Filtrar por ciudad si es necesario
    let filteredData = productosData;
    if (selectedCity !== 'global') {
        filteredData = filteredData.filter(item => item.ciudad === selectedCity);
    }
    
    let result = null;
    let excludedProducts = 0;
    let totalCombinations = 0;
    
    // Función auxiliar MEJORADA - Ahora recibe el campo de año específico
    function filterByMinRecords(data, yearField) {
        // 1. Determinar si estamos en un año específico o total
        const isSpecificYear = yearField !== 'total';
        
        // 2. Contar ocurrencias CORRECTAMENTE
        const combinationCounts = new Map();
        
        data.forEach(item => {
            if (!item.producto || !item.super || !item.marca) return;
            
            // Para año específico, solo contar si tiene variación para ese año
            if (isSpecificYear) {
                if (item[yearField] === null || item[yearField] === undefined) return;
            } else {
                // Para total, solo contar si tiene variacion_total
                if (item.variacion_total === null || item.variacion_total === undefined) return;
            }
            
            const key = `${item.producto}||${item.super}||${item.marca}`;
            combinationCounts.set(key, (combinationCounts.get(key) || 0) + 1);
        });
        
        totalCombinations = combinationCounts.size;
        
        // 3. Filtrar solo combinaciones con ≥3 registros
        const validCombinations = new Set();
        combinationCounts.forEach((count, key) => {
            if (count > 2) {
                validCombinations.add(key);
            } else {
                excludedProducts++;
            }
        });
        
        // 4. Tomar la variación más reciente de cada combinación válida
        const latestVariations = new Map();
        
        data.forEach(item => {
            if (!item.producto || !item.super || !item.marca) return;
            
            const key = `${item.producto}||${item.super}||${item.marca}`;
            
            // Solo procesar combinaciones válidas
            if (!validCombinations.has(key)) return;
            
            // Para año específico, verificar que tenga variación
            if (isSpecificYear) {
                if (item[yearField] === null || item[yearField] === undefined) return;
            } else {
                if (item.variacion_total === null || item.variacion_total === undefined) return;
            }
            
            const currentDate = new Date(item.fecha);
            const variacionValue = isSpecificYear ? 
                item[yearField] : item.variacion_total;
            
            // Tomar el registro más reciente
            if (!latestVariations.has(key) || currentDate > latestVariations.get(key).fecha) {
                latestVariations.set(key, {
                    fecha: currentDate,
                    variacion: variacionValue
                });
            }
        });
        
        // 5. Extraer solo las variaciones
        const validVariations = Array.from(latestVariations.values()).map(v => v.variacion);
        const validCombinationsCount = latestVariations.size;
        
        return {
            variations: validVariations,
            count: validCombinationsCount
        };
    }
    
    if (selectedYear === 'total') {
        // CÁLCULO PARA INFLACIÓN TOTAL
        const filtered = filterByMinRecords(filteredData, 'total');
        const validVariations = filtered.variations;
        const validProductsCount = filtered.count;
        
        result = {
            title: 'Inflación Total',
            description: 'Variación media de precios (solo productos con ≥3 registros totales)',
            inflation: validVariations.length > 0 ? 
                validVariations.reduce((a, b) => a + b, 0) / validVariations.length : 0,
            productCount: validProductsCount,
            recordCount: validVariations.length,
            excludedCount: excludedProducts,
            totalCombinations: totalCombinations,
            year: 'Total'
        };
        
    } else {
        // CÁLCULO PARA AÑO ESPECÍFICO
        const yearField = `variacion_${selectedYear}`;
        
        const filtered = filterByMinRecords(filteredData, yearField);
        const validVariations = filtered.variations;
        const validProductsCount = filtered.count;
        
        result = {
            title: `Inflación ${selectedYear}`,
            description: `Variación media durante el año ${selectedYear} (solo productos con ≥3 registros en ${selectedYear})`,
            inflation: validVariations.length > 0 ? 
                validVariations.reduce((a, b) => a + b, 0) / validVariations.length : 0,
            productCount: validProductsCount,
            recordCount: validVariations.length,
            excludedCount: excludedProducts,
            totalCombinations: totalCombinations,
            year: selectedYear
        };
    }
    
    // Mostrar resultados (igual que antes)
    statsContainer.innerHTML = `
        <div class="inflation-stat-card highlight">
            <div class="inflation-stat-icon">
                <i class="fas fa-chart-line"></i>
            </div>
            <div class="inflation-stat-content">
                <h4>${result.title}</h4>
                <p class="inflation-stat-number ${result.inflation >= 0 ? 'positive' : 'negative'}">
                    ${result.inflation >= 0 ? '+' : ''}${result.inflation.toFixed(1)}%
                </p>
                <small>${result.description}</small>
                ${result.excludedCount > 0 ? 
                    `<br><small class="excluded-info">
                        <i class="fas fa-filter"></i> 
                        ${result.excludedCount} productos excluidos (menos de 3 registros)
                    </small>` : ''
                }
            </div>
        </div>
        
        <div class="inflation-stat-card">
            <div class="inflation-stat-icon">
                <i class="fas fa-box"></i>
            </div>
            <div class="inflation-stat-content">
                <h4>Productos Analizados</h4>
                <p class="inflation-stat-number">${result.productCount}</p>
                <small>Combinaciones con suficientes datos (≥3 registros)</small>
                ${result.totalCombinations > 0 ? 
                    `<br><small>De ${result.totalCombinations} combinaciones totales</small>` : ''
                }
            </div>
        </div>
        
        <div class="inflation-stat-card">
            <div class="inflation-stat-icon">
                <i class="fas fa-database"></i>
            </div>
            <div class="inflation-stat-content">
                <h4>Variaciones Válidas</h4>
                <p class="inflation-stat-number">${result.recordCount}</p>
                <small>Variaciones después de aplicar filtros</small>
            </div>
        </div>
        
        <div class="inflation-stat-card">
            <div class="inflation-stat-icon">
                <i class="fas fa-calendar"></i>
            </div>
            <div class="inflation-stat-content">
                <h4>Período</h4>
                <p class="inflation-stat-number">${result.year}</p>
                <small>Año de análisis</small>
            </div>
        </div>
        
        ${result.excludedCount > 0 ? `
        <div class="inflation-stat-card info-card">
            <div class="inflation-stat-icon">
                <i class="fas fa-info-circle"></i>
            </div>
            <div class="inflation-stat-content">
                <h4>Nota Metodológica</h4>
                <p>Se excluyeron ${result.excludedCount} productos por tener menos de 3 registros.</p>
                <small>Esto asegura que la inflación se calcule solo con datos confiables.</small>
            </div>
        </div>
        ` : ''}
    `;
}

// Mostrar filtros (pantalla separada)
function showFilterScreen(filterType, options) {
    const container = document.getElementById('filter-options');
    const results = document.getElementById('filter-results');
    
    container.innerHTML = '';
    results.innerHTML = '';
    
    if (filterType === 'supermarket') {
        document.getElementById('filter-title').textContent = 'Filtrar por Supermercado';
    } else if (filterType === 'city') {
        document.getElementById('filter-title').textContent = 'Filtrar por Ciudad';
    } else if (filterType === 'brand') {
        document.getElementById('filter-title').textContent = 'Filtrar por Marca';
    }
    
    // Crear botones de opciones
    options.forEach(option => {
        if (!option) return;
        
        const button = document.createElement('button');
        button.className = 'filter-option';
        button.textContent = option;
        button.addEventListener('click', () => {
            showFilterResults(filterType, option);
        });
        container.appendChild(button);
    });
    
    showScreen('filter');
}

// Mostrar resultados de filtro (pantalla separada)
function showFilterResults(filterType, value) {
    const results = document.getElementById('filter-results');
    
    // Filtrar datos
    let filteredData;
    if (filterType === 'supermarket') {
        filteredData = productosData.filter(p => p.super === value);
    } else if (filterType === 'city') {
        filteredData = productosData.filter(p => p.ciudad === value);
    } else if (filterType === 'brand') {
        filteredData = productosData.filter(p => p.marca === value);
    }
    
    // Productos únicos en este filtro
    const uniqueProductsInFilter = [...new Set(filteredData.map(p => p.producto))];
    
    // Mostrar resultados
    results.innerHTML = `
        <h3>${value}</h3>
        <div class="filter-stats">
            <div>
                <small>Registros</small>
                <p>${filteredData.length}</p>
            </div>
            <div>
                <small>Productos</small>
                <p>${uniqueProductsInFilter.length}</p>
            </div>
            <div>
                <small>Rango de fechas</small>
                <p>${
                    filteredData.length > 0 ? 
                    new Date(Math.min(...filteredData.map(p => new Date(p.fecha)))).toLocaleDateString('es-ES') + 
                    ' - ' + 
                    new Date(Math.max(...filteredData.map(p => new Date(p.fecha)))).toLocaleDateString('es-ES') 
                    : '-'
                }</p>
            </div>
        </div>
        <div class="filter-products">
            <h4>Productos principales:</h4>
            ${uniqueProductsInFilter.slice(0, 10).map(product => `
                <div class="filter-product-item">
                    <span>${product}</span>
                    <button onclick="searchProduct('${product.replace(/'/g, "\\'")}')">
                        <i class="fas fa-chart-line"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

// Event Listeners
function initEventListeners() {
    // Botones de acciones rápidas
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            
            switch(action) {
                case 'variation-analysis':
                    showVariationAnalysis();
                    break;
                case 'inflation-analysis':
                    showInflationAnalysis();
                    break;
                case 'by-supermarket':
                    showFilterScreen('supermarket', Array.from(supermarkets));
                    break;
                case 'by-city':
                    showFilterScreen('city', Array.from(cities));
                    break;
                case 'by-brand':
                    showFilterScreen('brand', Array.from(brands));
                    break;
            }
        });
    });
    
    // Botones de volver
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            showScreen('main');
        });
    });
    
    // Tabs en pantalla de variación
    document.querySelectorAll('#variation-screen .tab-btn').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabType = this.dataset.tab;
            
            // Actualizar tabs activos
            document.querySelectorAll('#variation-screen .tab-btn').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Mostrar contenido
            if (tabType === 'increases') {
                showTopVariations('increases');
            } else {
                showTopVariations('decreases');
            }
        });
    });
}

// Mostrar/ocultar pantallas
function showScreen(screenName) {
    // Ocultar todas las pantallas
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    
    // Mostrar pantalla solicitada
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

// Utilidades
function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.remove('hidden');
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
}

function showError(message) {
    const errorToast = document.getElementById('error-toast');
    const errorMessage = document.getElementById('error-message');
    
    if (errorToast && errorMessage) {
        errorMessage.textContent = message;
        errorToast.classList.remove('hidden');
        
        setTimeout(() => {
            errorToast.classList.add('hidden');
        }, 5000);
    } else {
        alert(message);
    }
}

// Hacer funciones disponibles globalmente
window.searchProduct = searchProduct;

// Función para debug
window.debugProduct = function(productName) {
    const exactMatches = productosData.filter(p => 
        p.producto && p.producto.toLowerCase() === productName.toLowerCase()
    );
    
    console.log('=== DEBUG PRODUCTO ===');
    console.log('Producto buscado:', productName);
    console.log('Coincidencias exactas:', exactMatches.length);
    
    const partialMatches = productosData.filter(p => 
        p.producto && p.producto.toLowerCase().includes(productName.toLowerCase())
    );
    console.log('Coincidencias parciales:', partialMatches.length);
    
    const groups = {};
    exactMatches.forEach(item => {
        const key = item.super || 'Sin supermercado';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    
    console.log('Por supermercado:');
    Object.entries(groups).forEach(([superName, items]) => {
        console.log(`  ${superName}: ${items.length} registros`);
        items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        console.log(`    Fechas: ${items[0].fecha} → ${items[items.length-1].fecha}`);
        console.log(`    Precios: ${items[0].precio} → ${items[items.length-1].precio}`);
        console.log(`    Precios netos: ${items[0].precio_neto} → ${items[items.length-1].precio_neto}`);
    });
    
    return exactMatches;
};

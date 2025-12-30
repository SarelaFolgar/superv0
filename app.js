// Variables globales
let productosData = [];
let uniqueProducts = [];
let supermarkets = new Set();
let cities = new Set();
let brands = new Set();
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
    
    console.log(`📊 ${uniqueProducts.length} productos únicos`);
    console.log(`🏪 ${supermarkets.size} supermercados`);
    console.log(`🏙️ ${cities.size} ciudades`);
    console.log(`🏷️ ${brands.size} marcas`);
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

// Buscar producto (SOLO COINCIDENCIA EXACTA)
function searchProduct(productName) {
    const query = productName.toLowerCase().trim();
    if (!query) return;
    
    console.log('🔍 Buscando:', query);
    currentSearchTerm = query;
    showLoading();
    
    try {
        // Buscar coincidencias EXACTAS (no parciales)
        const exactMatches = productosData.filter(p => 
            p.producto && p.producto.toLowerCase() === query
        );
        
        console.log('📊 Resultados exactos encontrados:', exactMatches.length);
        
        if (exactMatches.length === 0) {
            // Si no hay coincidencia exacta, buscar productos que COMIENCEN con el término
            const startsWithMatches = productosData.filter(p => 
                p.producto && p.producto.toLowerCase().startsWith(query + ' ')
            );
            
            if (startsWithMatches.length > 0) {
                // Mostrar sugerencias si hay productos que comienzan con el término
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
        
        // Ordenar por fecha (más reciente primero)
        exactMatches.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Actualizar título CON NOMBRE EXACTO
        const titleElem = document.getElementById('product-title');
        if (titleElem) {
            titleElem.textContent = exactMatches[0].producto;
        }
        
        // Resetear filtros a valores por defecto
        currentFilters = {
            city: 'global',
            supermarket: 'global',
            brand: 'global'
        };
        
        // Mostrar resumen INICIAL (sin filtros)
        updateProductSummary(exactMatches, currentFilters);
        
        // Crear gráfico (con separación por marca + supermercado)
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
        // SIEMPRE ocultar el loading
        hideLoading();
    }
}

// Actualizar resumen del producto (ACTUALIZABLE CON FILTROS)
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
        // Si no hay datos con los filtros aplicados, mostrar guiones
        document.getElementById('current-price').textContent = '-';
        document.getElementById('total-variation').textContent = '-';
        document.getElementById('total-records-result').textContent = '0';
        document.getElementById('last-record-date').textContent = '-';
        
        // Actualizar contextos
        document.getElementById('current-price-context').textContent = 'Sin datos con filtros';
        document.getElementById('variation-context').textContent = 'Sin datos con filtros';
        document.getElementById('records-context').textContent = 'Sin datos con filtros';
        document.getElementById('date-context').textContent = 'Sin datos con filtros';
        return;
    }
    
    // Ordenar por fecha (más reciente primero para precio actual)
    filteredData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    // PRECIO ACTUAL: El precio NORMAL más reciente (no precio_neto)
    const mostRecentRecord = filteredData[0];
    const currentPrice = mostRecentRecord.precio || 0; // Usar precio normal, NO precio_neto
    document.getElementById('current-price').textContent = `${currentPrice.toFixed(2)}€`;
    
    // Para variación necesitamos el primer y último registro ordenados por fecha ascendente
    const sortedForVariation = [...filteredData].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const firstRecord = sortedForVariation[0];
    const lastRecord = sortedForVariation[sortedForVariation.length - 1];
    
    // VARIACIÓN: Usar precio_neto (como antes)
    const firstPrice = firstRecord.precio_neto !== undefined ? firstRecord.precio_neto : firstRecord.precio;
    const lastPrice = lastRecord.precio_neto !== undefined ? lastRecord.precio_neto : lastRecord.precio;
    let variation = 0;
    
    if (firstPrice > 0) {
        variation = ((lastPrice - firstPrice) / firstPrice) * 100;
    }
    
    const variationElem = document.getElementById('total-variation');
    variationElem.textContent = `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
    variationElem.className = `variation-large ${variation >= 0 ? 'positive' : 'negative'}`;
    
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

// Crear gráfico de precios - VERSIÓN MEJORADA
function createPriceChart(productData, filters = { city: 'global', supermarket: 'global', brand: 'global' }) {
    console.log('📈 Creando gráfico (Marca + Supermercado)');
    console.log('Filtros actuales:', filters);
    
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
            // Crear gráfico vacío con mensaje informativo
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
            
            // Agregar ciudad, supermercado y marca al conjunto
            if (item.ciudad) {
                ciudadesDisponibles.add(item.ciudad);
            }
            if (item.super) {
                supermercadosDisponibles.add(item.super);
            }
            if (item.marca) {
                marcasDisponibles.add(item.marca);
            }
            
            // Usar marca si existe, sino "Sin marca"
            const marca = item.marca || 'Sin marca';
            
            // Crear clave: MARCA + SUPERMERCADO
            const key = `${marca} | ${item.super}`;
            
            if (!groups[key]) {
                groups[key] = {
                    marca: marca,
                    super: item.super,
                    datos: []
                };
            }
            
            // Convertir fecha
            const fecha = new Date(item.fecha);
            if (isNaN(fecha.getTime())) {
                console.warn('Fecha inválida:', item.fecha);
                return;
            }
            
            // Usar precio neto para el gráfico principal
            const precio = item.precio_neto !== undefined ? item.precio_neto : item.precio;
            if (typeof precio !== 'number' || isNaN(precio)) {
                console.warn('Precio inválido:', precio);
                return;
            }
            
            groups[key].datos.push({
                fecha: fecha,
                precio: precio,
                ciudad: item.ciudad || 'Desconocida',
                precio_neto: item.precio_neto // Guardamos también para detalles
            });
        });
        
        console.log('Combinaciones encontradas (Marca + Super):', Object.keys(groups).length);
        
        // Ordenar cada grupo por fecha
        const validGroups = {};
        for (const [key, group] of Object.entries(groups)) {
            if (group.datos.length > 0) {
                // Ordenar por fecha
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
            
            // Calcular variación si hay más de un punto
            let label = `${marca} (${supermercado})`;
            
            if (datos.length >= 2) {
                const firstPrice = datos[0].precio;
                const lastPrice = datos[datos.length - 1].precio;
                if (firstPrice > 0) {
                    const variacion = ((lastPrice - firstPrice) / firstPrice) * 100;
                    label = `${marca} (${supermercado}) ${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%`;
                }
            }
            
            // Configurar el dataset
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
                                // Quitar el % de variación si existe
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
        
        // Crear gráfico vacío con mensaje
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
            // Actualizar resumen con filtros
            updateProductSummary(productData, currentFilters);
            
            // Actualizar gráfico con filtros
            createPriceChart(productData, currentFilters);
            
            // Actualizar detalles
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
            // Actualizar resumen sin filtros
            updateProductSummary(productData, currentFilters);
            
            // Actualizar gráfico sin filtros
            createPriceChart(productData, currentFilters);
            
            // Actualizar detalles sin filtros
            showBrandDetails(productData, currentFilters);
            
            hideLoading();
        }, 100);
    });
}

// Actualizar selector de filtros
function updateFilterSelector(selectElement, options, selectedValue) {
    if (!selectElement) return;
    
    // Guardar la opción actual seleccionada
    const currentValue = selectElement.value;
    
    // Limpiar opciones excepto la primera
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Ordenar opciones alfabéticamente
    options.sort();
    
    // Añadir opciones
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        selectElement.appendChild(opt);
    });
    
    // Restaurar selección si existe en las nuevas opciones
    if (options.includes(currentValue)) {
        selectElement.value = currentValue;
    } else {
        selectElement.value = selectedValue;
    }
}

// Mostrar detalles por marca/supermercado (CON FILTROS) - MANTENIENDO precio_neto
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
        
        // Ordenar por fecha
        group.datos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        
        const firstItem = group.datos[0];
        const lastItem = group.datos[group.datos.length - 1];
        
        // USAR precio_neto PARA DETALLES (como pediste)
        const firstPrice = firstItem.precio_neto !== undefined ? firstItem.precio_neto : firstItem.precio;
        const lastPrice = lastItem.precio_neto !== undefined ? lastItem.precio_neto : lastItem.precio;
        
        let variacion = 0;
        let variacionTexto = 'N/A';
        if (firstPrice > 0 && typeof firstPrice === 'number') {
            variacion = ((lastPrice - firstPrice) / firstPrice) * 100;
            variacionTexto = `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%`;
        }
        
        // Calcular precio promedio usando precio_neto
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

// Mostrar top productos (sin cambios)
function showTopVariations(type) {
    showLoading();
    
    // Calcular variación por producto
    const productStats = {};
    
    productosData.forEach(item => {
        const product = item.producto;
        if (!productStats[product]) {
            productStats[product] = {
                nombre: product,
                records: []
            };
        }
        productStats[product].records.push({
            fecha: new Date(item.fecha),
            precio: item.precio_neto || item.precio || 0
        });
    });
    
    // Calcular variaciones
    const productsWithVariation = [];
    
    Object.values(productStats).forEach(stat => {
        if (stat.records.length >= 2) {
            stat.records.sort((a, b) => a.fecha - b.fecha);
            const firstPrice = stat.records[0].precio;
            const lastPrice = stat.records[stat.records.length - 1].precio;
            
            if (firstPrice > 0) {
                stat.variation = ((lastPrice - firstPrice) / firstPrice) * 100;
                stat.firstPrice = firstPrice;
                stat.lastPrice = lastPrice;
                productsWithVariation.push(stat);
            }
        }
    });
    
    // Ordenar
    if (type === 'increases') {
        productsWithVariation.sort((a, b) => b.variation - a.variation);
        document.getElementById('top-title').textContent = 'Mayores Subidas';
    } else {
        productsWithVariation.sort((a, b) => a.variation - b.variation);
        document.getElementById('top-title').textContent = 'Mayores Bajadas';
    }
    
    // Mostrar top 10
    const containerId = type === 'increases' ? 'top-increases' : 'top-decreases';
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const topProducts = productsWithVariation.slice(0, 10);
    
    if (topProducts.length === 0) {
        container.innerHTML = '<p class="no-data">No hay datos suficientes</p>';
    } else {
        topProducts.forEach((product, index) => {
            const item = document.createElement('div');
            item.className = 'top-item';
            item.innerHTML = `
                <div class="top-rank">${index + 1}</div>
                <div class="top-info">
                    <h4>${product.nombre}</h4>
                    <div class="top-stats">
                        <span>${product.firstPrice.toFixed(2)}€ → ${product.lastPrice.toFixed(2)}€</span>
                        <span class="${product.variation >= 0 ? 'positive' : 'negative'}">
                            ${product.variation >= 0 ? '+' : ''}${product.variation.toFixed(1)}%
                        </span>
                    </div>
                    <small>${product.records.length} registros</small>
                </div>
                <button class="view-btn" onclick="searchProduct('${product.nombre.replace(/'/g, "\\'")}')">
                    <i class="fas fa-chart-line"></i>
                </button>
            `;
            container.appendChild(item);
        });
    }
    
    // Mostrar pantalla
    showScreen('top');
    
    // Activar tab correspondiente
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === type) {
            btn.classList.add('active');
        }
    });
    
    // Mostrar lista correcta
    document.getElementById('top-increases').classList.toggle('hidden', type !== 'increases');
    document.getElementById('top-decreases').classList.toggle('hidden', type !== 'decreases');
    
    hideLoading();
}

// Resto de funciones sin cambios (showFilterScreen, showFilterResults, initEventListeners, showScreen, etc.)
// ... [mantener el resto del código igual que antes] ...

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
                case 'top-increases':
                    showTopVariations('increases');
                    break;
                case 'top-decreases':
                    showTopVariations('decreases');
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
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabType = this.dataset.tab;
            
            // Actualizar tabs activos
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
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
        
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            errorToast.classList.add('hidden');
        }, 5000);
    } else {
        // Fallback a alert si no hay toast
        alert(message);
    }
}

// Hacer searchProduct disponible globalmente
window.searchProduct = searchProduct;

// Función para verificar datos de un producto
function debugProduct(productName) {
    const exactMatches = productosData.filter(p => 
        p.producto && p.producto.toLowerCase() === productName.toLowerCase()
    );
    
    console.log('=== DEBUG PRODUCTO ===');
    console.log('Producto buscado:', productName);
    console.log('Coincidencias exactas:', exactMatches.length);
    
    // También mostrar coincidencias parciales para debugging
    const partialMatches = productosData.filter(p => 
        p.producto && p.producto.toLowerCase().includes(productName.toLowerCase())
    );
    console.log('Coincidencias parciales:', partialMatches.length);
    
    // Agrupar por supermercado
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
}

// Hacerla disponible globalmente
window.debugProduct = debugProduct;
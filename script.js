// 調試模式 - 在控制台顯示詳細信息
const DEBUG = true;

// 增強console.log
function debugLog(...args) {
    if (DEBUG) {
        console.log(`[${new Date().toISOString()}]`, ...args);
    }
}

// 處理未捕獲錯誤
window.onerror = function(message, source, lineno, colno, error) {
    debugLog('未捕獲錯誤:', message, 'at', source, 'line:', lineno);
    return false;
};

// 檢測設備是否為手機
function isMobileDevice() {
    return (window.innerWidth <= 768);
}

// 添加手機控制元素
function addMobileControls() {
    if (isMobileDevice()) {
        // 創建一個切換按鈕
        const toggleButton = document.createElement('div');
        toggleButton.innerHTML = '顯示路線';
        toggleButton.style.position = 'absolute';
        toggleButton.style.bottom = '20px';
        toggleButton.style.left = '50%';
        toggleButton.style.transform = 'translateX(-50%)';
        toggleButton.style.backgroundColor = '#4285F4';
        toggleButton.style.color = 'white';
        toggleButton.style.padding = '10px 15px';
        toggleButton.style.borderRadius = '20px';
        toggleButton.style.display = 'none';
        toggleButton.style.zIndex = '1000';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        toggleButton.style.fontWeight = 'bold';
        toggleButton.id = 'toggle-directions';
        
        toggleButton.onclick = function() {
            const panel = document.getElementById('directions-panel');
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                this.innerHTML = '隱藏路線';
            } else {
                panel.style.display = 'none';
                this.innerHTML = '顯示路線';
            }
        };
        
        document.body.appendChild(toggleButton);
    }
}

// 資源將從CSV中讀取
let resources = [];

// 資源類別對應的顏色
const categoryColors = {
    foundation: '#FF5722',    // 橙色 - 基金會
    chief: '#4CAF50',         // 綠色 - 里長
    church: '#2196F3',        // 藍色 - 教會
    locksmith: '#FFC107'      // 黃色 - 鎖匠
};

// 資源類別對應的中文名稱
const categoryNames = {
    foundation: '基金會',
    chief: '里長',
    church: '教會',
    locksmith: '鎖匠'
};

let map;
let markers = [];
let activeInfoWindow = null;
let geocoder;
let directionsRenderer;

// 修改為initializeMap函數，將由Google Maps API callback調用
window.initializeMap = function() {
    debugLog("初始化地圖");
    
    // 初始化geocoder
    geocoder = new google.maps.Geocoder();
    
    // 台灣中心點
    const center = { lat: 25.0330, lng: 121.5654 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: center,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
    });
    
    // 初始化路線渲染器
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        panel: document.getElementById('directions-panel')
    });

    // 使用XMLHttpRequest載入CSV以避免CORS問題
    loadCSV(function(csvData) {
        if (csvData) {
            // 解析CSV數據
            parseCSV(csvData);
            
            // 更新資源列表
            updateResourceList(resources);
        } else {
            debugLog("無法載入CSV數據");
        }
    });
    
    // 添加搜尋監聽器
    document.getElementById('search-input').addEventListener('input', function(e) {
        filterResources();
    });
    
    // 添加類別過濾器監聽器
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterResources();
        });
    });
    
    // 添加手機控制元素
    addMobileControls();
};

// 使用XMLHttpRequest載入CSV
function loadCSV(callback) {
    debugLog("嘗試載入CSV文件");
    
    // 依次嘗試不同文件名
    const fileNames = ['welfare_resources_utf8.csv', '非正式資源編碼.csv'];
    tryLoadCSV(fileNames, 0, callback);
}

// 遞迴嘗試載入不同文件名的CSV
function tryLoadCSV(fileNames, index, callback) {
    if (index >= fileNames.length) {
        debugLog("所有CSV文件嘗試均失敗");
        callback(null);
        useSampleData();
        return;
    }
    
    const fileName = fileNames[index];
    debugLog("嘗試載入:", fileName);
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', fileName, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            debugLog(fileName + " 請求完成，狀態:", xhr.status);
            if (xhr.status === 200) {
                debugLog('CSV數據載入成功');
                callback(xhr.responseText);
            } else {
                debugLog('無法加載文件:', fileName);
                // 嘗試下一個文件名
                tryLoadCSV(fileNames, index + 1, callback);
            }
        }
    };
    xhr.send();
}

// 使用示例數據
function useSampleData() {
    debugLog("使用示例數據");
    resources = [
        {
            id: 1,
            name: '某基金會',
            category: 'foundation',
            address: '桃園市中正區羅斯福路一段7號',
            phone: '02-2321-1234'
        },
        {
            id: 2,
            name: '某里長辦公室',
            category: 'chief',
            address: '桃園市中山區南京東路142號',
            phone: '02-2505-6789'
        },
        {
            id: 3,
            name: '某教會',
            category: 'church',
            address: '桃園市大安區和平東路二段86號',
            phone: '02-2736-5432'
        },
        {
            id: 4,
            name: '某鎖匠店',
            category: 'locksmith',
            address: '桃園市大同區承德路三段153號',
            phone: '02-2592-7654'
        }
    ];
    
    // 為示例數據添加標記
    resources.forEach(resource => {
        geocodeAddress(resource);
    });
    
    // 更新資源列表
    updateResourceList(resources);
}

// 解析CSV數據
function parseCSV(csvData) {
    // 分割為行
    const rows = csvData.split('\n');
    
    // 獲取標題行
    const headers = rows[0].split(',');
    debugLog('CSV標題行:', headers);
    
    // 找出各欄位的索引位置（更寬容的匹配方式）
    const nameIndex = headers.findIndex(h => 
        h.trim().includes('名稱') || 
        h.trim().includes('機構') || 
        h.trim().toLowerCase().includes('name'));
    
    const categoryIndex = headers.findIndex(h => 
        h.trim().includes('類別') || 
        h.trim().includes('分類') || 
        h.trim().includes('種類') ||
        h.trim().toLowerCase().includes('category') ||
        h.trim().toLowerCase().includes('type'));
    
    const addressIndex = headers.findIndex(h => 
        h.trim().includes('地址') || 
        h.trim().toLowerCase().includes('address'));
    
    const phoneIndex = headers.findIndex(h => 
        h.trim().includes('電話') || 
        h.trim().includes('聯絡') ||
        h.trim().toLowerCase().includes('phone') || 
        h.trim().toLowerCase().includes('contact'));
    
    debugLog('欄位索引:', {nameIndex, categoryIndex, addressIndex, phoneIndex});
    
    // 如果找不到欄位，嘗試使用順序預設值
    if (nameIndex === -1) debugLog('找不到名稱欄位，將使用第2欄');
    if (categoryIndex === -1) debugLog('找不到類別欄位，將使用第5欄');
    if (addressIndex === -1) debugLog('找不到地址欄位，將使用第3欄');
    if (phoneIndex === -1) debugLog('找不到電話欄位，將使用第4欄');
    
    // 設定預設索引（基於您提供的CSV欄位順序）
    const defaultNameIndex = 1; // 第2欄
    const defaultAddressIndex = 2; // 第3欄
    const defaultPhoneIndex = 3; // 第4欄
    const defaultCategoryIndex = 4; // 第5欄
    
    // 解析資料行
    for (let i = 1; i < rows.length; i++) {
        // 跳過空行
        if (rows[i].trim() === '') continue;
        
        // 分割欄位（處理可能包含逗號的欄位）
        const columns = rows[i].split(',');
        
        // 如果欄位數不夠，跳過這一行
        if (columns.length < 3) {
            debugLog(`第${i}行欄位不足，已跳過:`, rows[i]);
            continue;
        }
        
        // 從欄位創建資源對象
        const resource = {
            id: i,
            name: columns[nameIndex !== -1 ? nameIndex : defaultNameIndex] || '未知名稱',
            category: mapCategory(columns[categoryIndex !== -1 ? categoryIndex : defaultCategoryIndex] || ''),
            address: columns[addressIndex !== -1 ? addressIndex : defaultAddressIndex] || '未知地址',
            phone: columns[phoneIndex !== -1 ? phoneIndex : defaultPhoneIndex] || '未知電話'
        };
        
        // 去除可能存在的引號
        resource.name = resource.name.replace(/["']/g, '').trim();
        resource.address = resource.address.replace(/["']/g, '').trim();
        resource.phone = resource.phone.replace(/["']/g, '').trim();
        
        // 如果地址為空或明顯不正確，跳過
        if (!resource.address || resource.address === '未知地址') {
            debugLog(`第${i}行地址無效，已跳過:`, resource);
            continue;
        }
        
        // 將資源添加到數組
        resources.push(resource);
        
        // 進行地理編碼
        geocodeAddress(resource);
    }
    
    debugLog('已載入資源:', resources.length);
}

// 將類別文字映射到代碼類別
function mapCategory(categoryText) {
    if (!categoryText) return 'foundation'; // 預設為基金會
    
    categoryText = categoryText.toString().trim().toLowerCase();
    
    const categoryMap = {
        '基金': 'foundation',
        '基金會': 'foundation',
        '財團': 'foundation',
        '里長': 'chief',
        '里辦': 'chief',
        '里辦公室': 'chief',
        '教會': 'church',
        '堂會': 'church',
        '教堂': 'church',
        '鎖匠': 'locksmith',
        '鎖行': 'locksmith',
        '開鎖': 'locksmith'
    };
    
    // 預設類別
    let result = 'foundation'; // 默認為基金會
    
    // 檢查類別文字是否包含任何關鍵詞
    for (const [keyword, category] of Object.entries(categoryMap)) {
        if (categoryText.includes(keyword)) {
            result = category;
            break;
        }
    }
    
    // 簡單類別值直接映射
    if (categoryText === 'foundation' || 
        categoryText === 'chief' || 
        categoryText === 'church' || 
        categoryText === 'locksmith') {
        result = categoryText;
    }
    
    return result;
}

// 地址轉換為坐標並添加標記
function geocodeAddress(resource) {
    debugLog("嘗試對地址進行地理編碼:", resource.address);
    
    geocoder.geocode({ 'address': resource.address, 'region': 'tw' }, function(results, status) {
        if (status === 'OK') {
            // 保存地理坐標到資源對象
            resource.position = results[0].geometry.location;
            debugLog("地理編碼成功:", resource.address, resource.position.lat(), resource.position.lng());
            
            // 添加標記
            const marker = new google.maps.Marker({
                map: map,
                position: resource.position,
                title: resource.name,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: categoryColors[resource.category] || '#FF0000',
                    fillOpacity: 0.9,
                    strokeWeight: 1,
                    strokeColor: '#FFFFFF',
                    scale: 10
                }
            });
            
            // 創建資訊視窗內容，修改為兩個按鈕
            const contentString = `
                <div class="marker-info">
                    <h3>${resource.name}</h3>
                    <p><strong>類型:</strong> ${categoryNames[resource.category]}</p>
                    <p><strong>地址:</strong> ${resource.address}</p>
                    <p><strong>電話:</strong> ${resource.phone}</p>
                    <p>
                        <button onclick="showDirectionsWithCurrentLocation('${resource.address.replace(/'/g, "\\'")}', ${resource.position.lat()}, ${resource.position.lng()})">從目前位置出發</button>
                        <button onclick="showDirectionsWithCustomLocation('${resource.address.replace(/'/g, "\\'")}', ${resource.position.lat()}, ${resource.position.lng()})">自訂出發地</button>
                    </p>
                </div>
            `;
            
            const infoWindow = new google.maps.InfoWindow({
                content: contentString
            });
            
            // 點擊標記時打開資訊視窗
            marker.addListener('click', function() {
                if (activeInfoWindow) {
                    activeInfoWindow.close();
                }
                infoWindow.open(map, marker);
                activeInfoWindow = infoWindow;
                
                // 將地圖中心移動到標記位置
                map.panTo(marker.getPosition());
            });
            
            // 存儲標記和對應的資源
            markers.push({
                marker: marker,
                resource: resource,
                infoWindow: infoWindow
            });
        } else {
            debugLog('Geocode 失敗，原因: ' + status + '，地址: ' + resource.address);
        }
    });
}

// 更新資源列表
function updateResourceList(filteredResources) {
    const resourceList = document.getElementById('resource-list');
    resourceList.innerHTML = '';
    
    filteredResources.forEach(resource => {
        const resourceItem = document.createElement('div');
        resourceItem.className = 'resource-item';
        resourceItem.innerHTML = `
            <strong>${resource.name}</strong><br>
            <small>${categoryNames[resource.category]} | ${resource.address}</small>
        `;
        
        // 點擊列表項目跳轉到對應的標記
        resourceItem.addEventListener('click', function() {
            const markerInfo = markers.find(m => m.resource.id === resource.id);
            if (markerInfo) {
                // 關閉現有資訊視窗
                if (activeInfoWindow) {
                    activeInfoWindow.close();
                }
                
                // 打開新資訊視窗
                markerInfo.infoWindow.open(map, markerInfo.marker);
                activeInfoWindow = markerInfo.infoWindow;
                
                // 移動地圖中心到標記位置
                map.panTo(markerInfo.marker.getPosition());
                map.setZoom(15);
            }
        });
        
        resourceList.appendChild(resourceItem);
    });
}

// 過濾資源
function filterResources() {
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const activeCategory = document.querySelector('.category-btn.active').dataset.category;
    
    // 過濾資源
    const filteredResources = resources.filter(resource => {
        // 類別過濾
        const categoryMatch = activeCategory === 'all' || resource.category === activeCategory;
        
        // 搜尋文字過濾
        const textMatch = searchText === '' ||
            resource.name.toLowerCase().includes(searchText) ||
            resource.address.toLowerCase().includes(searchText) ||
            resource.phone.toLowerCase().includes(searchText) ||
            (categoryNames[resource.category] && categoryNames[resource.category].toLowerCase().includes(searchText));
        
        return categoryMatch && textMatch;
    });
    
    // 更新標記顯示
    markers.forEach(markerInfo => {
        const visible = filteredResources.some(r => r.id === markerInfo.resource.id);
        markerInfo.marker.setVisible(visible);
    });
    
    // 更新資源列表
    updateResourceList(filteredResources);
}

// 使用當前位置規劃路線
function showDirectionsWithCurrentLocation(destAddress, destLat, destLng) {
    debugLog("使用當前位置規劃路線到:", destAddress);
    
    if (!navigator.geolocation) {
        alert("您的瀏覽器不支持地理定位功能，請使用自訂出發地。");
        showDirectionsWithCustomLocation(destAddress, destLat, destLng);
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const origin = { 
                lat: position.coords.latitude, 
                lng: position.coords.longitude 
            };
            debugLog("成功獲取用戶位置:", origin);
            calculateRoute(origin, destAddress, destLat, destLng);
            
            // 顯示切換按鈕（僅在手機上）
            if (isMobileDevice()) {
                const toggleButton = document.getElementById('toggle-directions');
                if (toggleButton) {
                    toggleButton.style.display = 'block';
                }
            }
        },
        function(error) {
            debugLog("獲取位置失敗:", error);
            alert("無法獲取您的當前位置，請使用自訂出發地。");
            showDirectionsWithCustomLocation(destAddress, destLat, destLng);
        },
        options
    );
}

// 使用自訂出發地規劃路線
function showDirectionsWithCustomLocation(destAddress, destLat, destLng) {
    const startAddress = prompt("請輸入您的出發地點：", "");
    
    if (!startAddress) {
        alert("未提供出發地點，無法規劃路線。");
        return;
    }
    
    debugLog("使用自訂出發地:", startAddress);
    
    geocoder.geocode({ 'address': startAddress, 'region': 'tw' }, function(results, status) {
        if (status === 'OK') {
            const origin = results[0].geometry.location;
            debugLog("出發地地理編碼成功:", startAddress, origin);
            calculateRoute(origin, destAddress, destLat, destLng);
            
            // 顯示切換按鈕（僅在手機上）
            if (isMobileDevice()) {
                const toggleButton = document.getElementById('toggle-directions');
                if (toggleButton) {
                    toggleButton.style.display = 'block';
                }
            }
        } else {
            debugLog("出發地地理編碼失敗:", status);
            alert("無法識別出發地址「" + startAddress + "」，請提供更精確的地址。");
        }
    });
}

// 計算路線
function calculateRoute(origin, destAddress, destLat, destLng) {
    debugLog("計算路線 從:", origin, "到:", destAddress);
    
    // 顯示路線面板
    const directionsPanel = document.getElementById('directions-panel');
    if (directionsPanel) {
        directionsPanel.style.display = 'block';
    }
    
    // 重置路線渲染器
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
    }
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        panel: directionsPanel
    });
    
    // 創建路線服務
    const directionsService = new google.maps.DirectionsService();
    
    // 優先使用經緯度作為目的地
    if (destLat && destLng) {
        debugLog("使用經緯度作為目的地");
        const destination = { lat: destLat, lng: destLng };
        
        directionsService.route({
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING
        }, function(response, status) {
            if (status === 'OK') {
                directionsRenderer.setDirections(response);
                debugLog("使用經緯度規劃路線成功");
            } else {
                debugLog("使用經緯度規劃路線失敗:", status);
                // 如果使用經緯度失敗，嘗試使用地址
                tryRouteWithAddress(directionsService, origin, destAddress);
            }
        });
    } else {
        // 使用地址作為目的地
        tryRouteWithAddress(directionsService, origin, destAddress);
    }
}

// 使用地址嘗試路線規劃
function tryRouteWithAddress(directionsService, origin, destAddress) {
    debugLog("使用地址作為目的地:", destAddress);
    
    directionsService.route({
        origin: origin,
        destination: destAddress,
        travelMode: google.maps.TravelMode.DRIVING,
        region: 'tw'
    }, function(response, status) {
        if (status === 'OK') {
            directionsRenderer.setDirections(response);
            debugLog("使用地址規劃路線成功");
        } else {
            debugLog("使用地址規劃路線失敗:", status);
            handleRoutingError(status);
        }
    });
}

// 處理路線規劃錯誤
function handleRoutingError(status) {
    let errorMessage = "無法規劃路線";
    
    switch(status) {
        case 'ZERO_RESULTS':
            errorMessage += "：找不到可行駛的路線。";
            break;
        case 'NOT_FOUND':
            errorMessage += "：找不到起點或終點位置。";
            break;
        case 'OVER_QUERY_LIMIT':
            errorMessage += "：API使用超出限制，請稍後再試。";
            break;
        case 'REQUEST_DENIED':
            errorMessage += "：請求被拒絕，可能需要API金鑰。";
            break;
        case 'INVALID_REQUEST':
            errorMessage += "：請求無效，請檢查參數。";
            break;
        default:
            errorMessage += "：" + status;
    }
    
    alert(errorMessage);
}

// 確保在全局範圍可用
window.showDirectionsWithCurrentLocation = showDirectionsWithCurrentLocation;
window.showDirectionsWithCustomLocation = showDirectionsWithCustomLocation;

// 檢查第四步點擊問題的調試腳本
console.log('=== 調試第四步點擊問題 ===');

// 檢查按鈕元素
const submitButton = document.getElementById('step4-submit');
console.log('提交按鈕:', submitButton);
console.log('按鈕文字:', submitButton?.textContent);
console.log('按鈕是否禁用:', submitButton?.disabled);
console.log('按鈕點擊事件:', submitButton?.onclick);

// 檢查必要的全域變數
console.log('selectedOpportunity:', window.selectedOpportunity);
console.log('selectedEngineeringTypes:', window.selectedEngineeringTypes);
console.log('engineeringStats:', window.engineeringStats);

// 檢查 CONFIG 物件
console.log('CONFIG:', window.CONFIG);
console.log('WORKER_API_URL:', window.WORKER_API_URL);

// 檢查認證 token
const token = localStorage.getItem('auth_token');
console.log('認證 token 存在:', !!token);

// 檢查表單資料
const ownerSelect = document.getElementById('projectOwner');
console.log('業主選擇:', ownerSelect);
console.log('選中的業主:', ownerSelect ? Array.from(ownerSelect.selectedOptions) : 'None');

// 測試手動呼叫 createProject
console.log('=== 嘗試手動呼叫 createProject ===');
try {
    if (typeof createProject === 'function') {
        console.log('createProject 函數存在，準備呼叫...');
        // createProject(); // 先不真的執行，只是測試
        console.log('函數可以呼叫');
    } else {
        console.error('createProject 函數不存在！');
    }
} catch (error) {
    console.error('呼叫 createProject 時發生錯誤:', error);
}
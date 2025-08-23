// Display team icons (simplified version without carousel)
function displayTeams(teams) {
    const legendTeams = document.getElementById('legendTeams');
    if (!legendTeams) return;
    
    legendTeams.innerHTML = '';
    
    if (!teams || teams.length === 0) {
        legendTeams.innerHTML = '<span style="color: #9ca3af;">尚無工班</span>';
        return;
    }
    
    // 過濾工班：如果不是管理員且有特定工班歸屬，只顯示自己的工班
    let filteredTeams = teams;
    if (!window.isAdmin && window.userTeams && window.userTeams.size > 0) {
        filteredTeams = teams.filter(team => window.userTeams.has(team.name));
        console.log('工班過濾結果:', filteredTeams.map(t => t.name));
    }
    
    if (filteredTeams.length === 0) {
        legendTeams.innerHTML = '<span style="color: #9ca3af;">無可顯示的工班</span>';
        return;
    }
    
    // 統一使用 flex 布局，不區分行動版和桌面版
    const teamsContainer = document.createElement('div');
    teamsContainer.style.cssText = 'display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;';
    
    // 添加所有工班按鈕
    filteredTeams.forEach(team => {
        const teamButton = document.createElement('div');
        teamButton.style.cssText = `
            padding: 0.5rem 0.75rem; 
            background: linear-gradient(135deg, #84C7D0 0%, #6BB8C3 100%); 
            color: white; 
            border: none;
            border-radius: 12px; 
            font-weight: 500; 
            font-size: 0.875rem;
            display: flex; 
            align-items: center; 
            gap: 0.5rem; 
            min-width: 140px;
            box-shadow: 0 2px 8px rgba(132, 199, 208, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            flex-shrink: 0;
        `;
        
        // 工班名稱
        const teamNameSpan = document.createElement('span');
        teamNameSpan.style.cssText = `
            font-weight: 600;
            font-size: 0.875rem;
            flex-shrink: 0;
        `;
        teamNameSpan.textContent = team.abbreviation || team.name || `工班 ${team.id}`;
        
        // 計算統計數據
        const siteCount = team.siteCount || 0;
        const completedCount = team.completedCount || 0;
        const percentage = siteCount > 0 ? Math.round((completedCount / siteCount) * 100) : 0;
        
        // 完成數量顯示
        const countDisplay = document.createElement('span');
        countDisplay.style.cssText = `
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.9);
            margin-right: 0.25rem;
        `;
        countDisplay.textContent = `${completedCount}/${siteCount}`;
        
        // 進度條容器
        const waterContainer = document.createElement('div');
        waterContainer.style.cssText = `
            position: relative;
            width: 55px;
            height: 22px;
            background: linear-gradient(180deg, #E0E0E0 0%, #FFFFFF 50%, #E0E0E0 100%);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 
                inset 0 2px 4px rgba(0,0,0,0.2),
                inset 0 -2px 4px rgba(0,0,0,0.2),
                inset 2px 0 4px rgba(0,0,0,0.15),
                inset -2px 0 4px rgba(0,0,0,0.15);
            border: 1px solid #84C7D0;
        `;
        
        // 進度條填充
        const waterLevel = document.createElement('div');
        waterLevel.style.cssText = `
            position: absolute;
            left: 1px;
            top: 1px;
            height: calc(100% - 2px);
            width: calc(${percentage}% - 2px);
            background: linear-gradient(180deg, #FFA500 0%, #FF8C00 50%, #FF7F00 100%);
            border-radius: 7px;
            transition: width 0.8s ease-in-out;
            box-shadow: 0 1px 3px rgba(255,140,0,0.3);
        `;
        
        // 百分比文字
        const percentageText = document.createElement('span');
        percentageText.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 0.75rem;
            font-weight: 600;
            color: #333;
            z-index: 2;
            pointer-events: none;
        `;
        percentageText.textContent = `${percentage}%`;
        
        waterContainer.appendChild(waterLevel);
        waterContainer.appendChild(percentageText);
        
        // 百分比容器
        const percentageDisplay = document.createElement('div');
        percentageDisplay.className = 'percentage-display';
        percentageDisplay.style.cssText = 'display: flex; align-items: center; gap: 0.25rem;';
        percentageDisplay.appendChild(countDisplay);
        percentageDisplay.appendChild(waterContainer);
        
        teamButton.appendChild(teamNameSpan);
        teamButton.appendChild(percentageDisplay);
        teamsContainer.appendChild(teamButton);
    });
    
    // 添加 "未分配" 按鈕 (如果有未分配案場)
    if (window.unassignedSitesCount && window.unassignedSitesCount > 0) {
        const unassignedButton = document.createElement('button');
        unassignedButton.style.cssText = `
            padding: 0.5rem 0.75rem;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 500;
            font-size: 0.875rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            min-width: 100px;
            transition: all 0.2s ease;
            flex-shrink: 0;
        `;
        
        // 創建文字元素
        const labelText = document.createElement('span');
        labelText.textContent = '未分配';
        labelText.style.fontWeight = '600';
        
        const countText = document.createElement('span');
        countText.textContent = window.unassignedSitesCount.toString();
        countText.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 50%;
            min-width: 1.5rem;
            height: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 700;
        `;
        
        unassignedButton.appendChild(labelText);
        unassignedButton.appendChild(countText);
        
        // 添加懸停效果
        unassignedButton.onmouseenter = () => {
            unassignedButton.style.transform = 'scale(1.05)';
            unassignedButton.style.boxShadow = '0 4px 12px rgba(107, 114, 128, 0.4)';
            unassignedButton.style.background = '#4b5563';
        };
        unassignedButton.onmouseleave = () => {
            unassignedButton.style.transform = 'scale(1)';
            unassignedButton.style.boxShadow = 'none';
            unassignedButton.style.background = '#6b7280';
        };
        
        // 點擊事件 - 顯示未分配案場列表
        unassignedButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showUnassignedSitesModal();
        });
        
        teamsContainer.appendChild(unassignedButton);
    }
    
    legendTeams.appendChild(teamsContainer);
}
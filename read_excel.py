import pandas as pd

excel_file = '全部對象及欄位API .xlsx'
sheet_name = '案場(SPC)(object_8W9cb__c)'

# 讀取整個工作表
df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)

print('=== 搜尋棟別、樓層、戶別欄位 ===')
print()

# 搜尋包含關鍵字的行
for idx, row in df.iterrows():
    row_str = ' '.join(str(cell) for cell in row if pd.notna(cell))
    
    # 檢查是否包含棟別
    if '棟別' in row_str or 'field_WD7k1' in row_str:
        print(f'找到棟別欄位 (行 {idx}):')
        for col_idx, cell in enumerate(row):
            if pd.notna(cell):
                print(f'  欄位{col_idx}: {cell}')
        print()
    
    # 檢查是否包含樓層  
    if '樓層' in row_str or 'field_Q6Svh' in row_str:
        print(f'找到樓層欄位 (行 {idx}):')
        for col_idx, cell in enumerate(row):
            if pd.notna(cell):
                print(f'  欄位{col_idx}: {cell}')
        print()
    
    # 檢查是否包含戶別
    if '戶別' in row_str or 'field_XuJP2' in row_str:
        print(f'找到戶別欄位 (行 {idx}):')
        for col_idx, cell in enumerate(row):
            if pd.notna(cell):
                print(f'  欄位{col_idx}: {cell}')
        print()
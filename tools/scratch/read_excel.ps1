$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open("c:\Users\a9999\Dropbox\CodeBackups\CODING\tools\REF\781估價單_V3.1 111111.xlsx")

Write-Output "SHEETS:"
foreach ($sheet in $workbook.Sheets) {
    Write-Output $sheet.Name
}

# 我們使用特定工作表，或是第1個
$sheet = $workbook.Sheets.Item(1)
$name = $sheet.Name
Write-Output "SHEET_NAME: $name"

# 讀取前 200 行
for ($row = 1; $row -le 200; $row++) {
    $col1 = $sheet.Cells.Item($row, 1).Text
    $col2 = $sheet.Cells.Item($row, 2).Text
    $col3 = $sheet.Cells.Item($row, 3).Text
    $col4 = $sheet.Cells.Item($row, 4).Text
    $col5 = $sheet.Cells.Item($row, 5).Text
    $col6 = $sheet.Cells.Item($row, 6).Text
    $col7 = $sheet.Cells.Item($row, 7).Text
    
    # 檢查是否有內容
    $hasContent = $false
    if ($col1 -ne "") { $hasContent = $true }
    if ($col2 -ne "") { $hasContent = $true }
    if ($col3 -ne "") { $hasContent = $true }
    if ($col4 -ne "") { $hasContent = $true }
    
    if ($hasContent) {
        # 使用安全拼裝，避開 pipeline 解析字元
        $line = "Row " + $row + ": " + $col1 + " / " + $col2 + " / " + $col3 + " / " + $col4 + " / " + $col5 + " / " + $col6 + " / " + $col7
        Write-Output $line
    }
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

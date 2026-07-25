@echo off
chcp 65001 >nul
echo ========================================
echo   特殊事件档案库 - 数据库同步工具
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 正在检查 games.json ...
if not exist "public\data\games.json" (
    echo 错误: 找不到 public\data\games.json
    pause
    exit /b 1
)

echo [2/3] 正在同步到 Supabase ...
node sync-to-supabase.js

echo.
echo [3/3] 同步完成！
echo.
pause

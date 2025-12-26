@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Electron App - 启动应用
echo ========================================
echo.

:: 进入 electron-app 目录
cd /d "%~dp0..\electron-app"
if %errorlevel% neq 0 (
    echo [错误] 找不到 electron-app 目录
    pause
    exit /b 1
)

:: 检查依赖是否已安装
if not exist "node_modules" (
    echo [!] 依赖未安装，正在自动初始化...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请先运行 init.bat
        pause
        exit /b 1
    )
)

echo [*] 正在启动应用...
echo.
echo 提示: 按 Ctrl+C 可停止应用
echo.

:: 启动 Electron 开发模式（同时启动 Vite + Electron）
call npm run electron:dev

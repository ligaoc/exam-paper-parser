@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Electron App - 环境初始化
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 显示 Node.js 版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [√] Node.js 版本: %NODE_VERSION%

:: 进入 electron-app 目录
cd /d "%~dp0..\electron-app"
if %errorlevel% neq 0 (
    echo [错误] 找不到 electron-app 目录
    pause
    exit /b 1
)

:: 检查 node_modules 是否存在且完整
if exist "node_modules\.package-lock.json" (
    echo [√] 依赖已安装，检查更新...
    call npm install --prefer-offline
) else (
    echo [*] 正在安装依赖，请稍候...
    call npm install
)

if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   环境初始化完成！
echo ========================================
echo.
echo 可用命令:
echo   start.bat  - 启动开发环境
echo   build.bat  - 打包应用
echo.
pause

@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Electron App - 打包应用
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

:: 清理旧的打包文件
if exist "release" (
    echo [*] 清理旧的打包文件...
    taskkill /F /IM "Electron App.exe" 2>nul
    timeout /t 1 /nobreak >nul
    rmdir /s /q "release" 2>nul
)

echo [*] 步骤 1/2: 构建前端和主进程...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo [√] 构建完成

echo.
echo [*] 步骤 2/2: 打包 Windows 应用...
call npx electron-builder --dir --win --config electron-builder.json
if %errorlevel% neq 0 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   打包完成！
echo ========================================
echo.
echo 输出目录: electron-app\release
echo.

:: 打开输出目录
if exist "release" (
    explorer "release"
)

pause

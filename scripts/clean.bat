@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Electron App - 清理构建缓存
echo ========================================
echo.

:: 进入 electron-app 目录
cd /d "%~dp0..\electron-app"
if %errorlevel% neq 0 (
    echo [错误] 找不到 electron-app 目录
    pause
    exit /b 1
)

echo [*] 正在清理...

:: 清理构建输出
if exist "dist" (
    echo   - 删除 dist/
    rmdir /s /q "dist"
)

:: 清理打包输出
if exist "release" (
    echo   - 删除 release/
    rmdir /s /q "release"
)

:: 清理构建缓存
if exist "build" (
    echo   - 清理 build/
    del /q "build\*" 2>nul
)

echo.
echo [√] 清理完成
echo.
pause

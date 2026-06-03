@echo off
echo === Jamex Windows Build ===
echo.

:: Step 1: Build frontend
echo --- Building frontend ---
cd /d "%~dp0..\frontend"
call npm run build
if %ERRORLEVEL% neq 0 (
    echo Frontend build failed!
    pause
    exit /b 1
)

:: Step 2: Copy frontend dist to backend
echo.
echo --- Copying frontend dist to backend ---
if exist "%~dp0..\backend\dist" (
    rmdir /s /q "%~dp0..\backend\dist"
)
mkdir "%~dp0..\backend\dist"
xcopy /e /i /y "%~dp0..\frontend\dist\*" "%~dp0..\backend\dist\"

:: Step 3: Install backend dependencies
echo.
echo --- Installing backend dependencies ---
cd /d "%~dp0..\backend"
call npm install
if %ERRORLEVEL% neq 0 (
    echo Backend npm install failed!
    pause
    exit /b 1
)

:: Step 4: Install root dependencies (Electron)
echo.
echo --- Installing Electron dependencies ---
cd /d "%~dp0.."
call npm install
if %ERRORLEVEL% neq 0 (
    echo Root npm install failed!
    pause
    exit /b 1
)

:: Step 5: Build Electron app
echo.
echo --- Packaging Electron app ---
npx electron-builder --win --publish never
if %ERRORLEVEL% neq 0 (
    echo Electron build failed!
    pause
    exit /b 1
)

echo.
echo === Build complete! Check dist-electron\ folder ===
pause

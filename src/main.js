// Real file operations with proper error handling
// Add this section to the top of your main.js file


// Debug Tauri API availability
console.log('=== TAURI API DEBUG ===');
console.log('window.__TAURI__ exists:', !!window.__TAURI__);

if (window.__TAURI__) {
  console.log('Available Tauri APIs:', Object.keys(window.__TAURI__));
  
  // Check each API
  console.log('Core API:', !!window.__TAURI__.core);
  console.log('FS API:', !!window.__TAURI__.fs);  
  console.log('Dialog API:', !!window.__TAURI__.dialog);
  console.log('Path API:', !!window.__TAURI__.path);
  
  // Log the full structure
  console.log('Full Tauri object:', window.__TAURI__);
} else {
  console.log('Tauri not available - running in browser?');
}
console.log('=== END DEBUG ===');


let tauriApis = {
  fs: null,
  dialog: null,
  path: null
};

// FIXED TAURI V2 API ACCESS - Use direct functions instead of invoke
async function initializeTauriApis() {
  try {
    if (window.__TAURI__) {
      console.log('=== TAURI V2 API SETUP ===');
      console.log('Available Tauri APIs:', Object.keys(window.__TAURI__));
      
      // Test path API (this should work)
      if (window.__TAURI__.path) {
        try {
          const homeDir = await window.__TAURI__.path.homeDir();
          console.log('✅ Path API works! Home dir:', homeDir);
          tauriApis.path = window.__TAURI__.path;
        } catch (error) {
          console.error('❌ Path API failed:', error);
        }
      }
      
      // Use direct file system functions (Tauri v2 style)
      if (window.__TAURI__.fs) {
        console.log('✅ File system API found');
        console.log('Available FS functions:', Object.keys(window.__TAURI__.fs));
        
        // Test if readTextFile function exists and works
        try {
          tauriApis.fs = {
            readTextFile: window.__TAURI__.fs.readTextFile,
            writeTextFile: window.__TAURI__.fs.writeTextFile
          };
          
          console.log('✅ File system functions configured');
        } catch (error) {
          console.error('❌ File system functions failed to configure:', error);
        }
      }
      
      // Use direct dialog functions
      if (window.__TAURI__.dialog) {
        console.log('✅ Dialog API found');
        console.log('Available dialog functions:', Object.keys(window.__TAURI__.dialog));
        
        tauriApis.dialog = {
          open: window.__TAURI__.dialog.open,
          save: window.__TAURI__.dialog.save
        };
        
        console.log('✅ Dialog functions configured');
      }
      
      console.log('Final tauriApis state:', {
        fs: !!tauriApis.fs,
        dialog: !!tauriApis.dialog, 
        path: !!tauriApis.path
      });
      console.log('=== END TAURI SETUP ===');
      
      return tauriApis.fs !== null;
    }
    return false;
  } catch (error) {
    console.error('Error in Tauri API setup:', error);
    return false;
  }
}

// Real file operations
async function loadConfigFromFile() {
  try {
    if (!tauriApis.fs) {
      throw new Error('File system not available');
    }
    
    // Get user's home directory
    const homeDir = await tauriApis.path.homeDir();
    const configPath = `${homeDir}/.config/hypr/hyprland.conf`;
    
    console.log('Loading config from:', configPath);
    updateStatusBar(`Loading config from ${configPath}...`);
    
    // Read the actual config file
    const configContent = await tauriApis.fs.readTextFile(configPath);
    
    // Parse and load the config
    parseHyprlandConfig(configContent);
    appState.lastSavedConfig = configContent;
    appState.hasUnsavedChanges = false;
    updateChangeIndicator();
    
    updateStatusBar(`Config loaded successfully from ${configPath}`);
    return true;
    
  } catch (error) {
    console.error('Error loading config:', error);
    
    if (error.message.includes('No such file')) {
      updateStatusBar('No existing Hyprland config found - starting with defaults');
      loadSampleData();
    } else if (error.message.includes('Permission denied')) {
      updateStatusBar('Permission denied reading config file');
    } else {
      updateStatusBar(`Error loading config: ${error.message}`);
    }
    
    return false;
  }
}

async function saveAsTestFile() {
  try {
    if (!tauriApis.fs || !tauriApis.path) {
      console.log('File system not available - showing in Raw Config instead');
      saveAsTest(); // Fall back to demo mode
      return;
    }
    
    const homeDir = await tauriApis.path.homeDir();
    const testPath = `${homeDir}/.config/hypr/hyprland.test.conf`;
    const configContent = generateHyprlandConfig();
    
    console.log('Saving test file to:', testPath);
    updateStatusBar(`Saving test config to ${testPath}...`);
    
    // Write the test file
    await tauriApis.fs.writeTextFile(testPath, configContent);
    
    // Also update the raw config tab
    document.getElementById('raw-config').value = configContent;
    
    updateStatusBar(`Test config saved! Test with: hyprctl reload`);
    
    // Switch to raw config tab to show the result
    document.querySelector('[data-tab="raw"]').click();
    
  } catch (error) {
    console.error('Error saving test file:', error);
    updateStatusBar(`Error saving test file: ${error.message}`);
    
    // Fall back to demo mode
    saveAsTest();
  }
}

async function saveConfigPermanently() {
  try {
    if (!tauriApis.fs || !tauriApis.path) {
      console.log('File system not available - simulating save');
      savePermanentlyWithBackup(); // Fall back to demo mode
      return;
    }
    
    const homeDir = await tauriApis.path.homeDir();
    const configPath = `${homeDir}/.config/hypr/hyprland.conf`;
    const newConfig = generateHyprlandConfig();
    
    // Create timestamped backup name
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const backupPath = `${homeDir}/.config/hypr/hyprland.conf.backup-${timestamp}`;
    
    console.log('Creating backup:', backupPath);
    updateStatusBar('Creating backup of current config...');
    
    // Step 1: Create backup of existing config (if it exists)
    try {
      const existingConfig = await tauriApis.fs.readTextFile(configPath);
      await tauriApis.fs.writeTextFile(backupPath, existingConfig);
      console.log('Backup created successfully');
      
      // Add to our backup tracking
      appState.backups.unshift({
        name: `hyprland.conf.backup-${timestamp}`,
        timestamp: new Date(),
        size: existingConfig.length,
        path: backupPath
      });
      
    } catch (backupError) {
      if (backupError.message.includes('No such file')) {
        console.log('No existing config to backup - this is the first save');
      } else {
        throw new Error(`Failed to create backup: ${backupError.message}`);
      }
    }
    
    // Step 2: Write new config
    console.log('Saving new config to:', configPath);
    updateStatusBar('Saving new configuration...');
    
    await tauriApis.fs.writeTextFile(configPath, newConfig);
    
    // Step 3: Update app state
    appState.lastSavedConfig = newConfig;
    appState.hasUnsavedChanges = false;
    
    updateBackupsList();
    updateChangeIndicator();
    
    updateStatusBar(`Config saved successfully! Backup: hyprland.conf.backup-${timestamp}`);
    
    // Show success message with next steps
    setTimeout(() => {
      updateStatusBar('Config saved! Run "hyprctl reload" to apply changes');
    }, 3000);
    
  } catch (error) {
    console.error('Error saving config permanently:', error);
    updateStatusBar(`Error saving config: ${error.message}`);
    
    // Fall back to demo mode
    savePermanentlyWithBackup();
  }
}

async function restoreBackupFile(backupName) {
  try {
    if (!tauriApis.fs || !tauriApis.path) {
      console.log('File system not available - simulating restore');
      restoreBackup(backupName);
      return;
    }
    
    const homeDir = await tauriApis.path.homeDir();
    const backupPath = `${homeDir}/.config/hypr/${backupName}`;
    const configPath = `${homeDir}/.config/hypr/hyprland.conf`;
    
    console.log('Restoring backup from:', backupPath);
    updateStatusBar(`Restoring backup: ${backupName}...`);
    
    // Read backup file
    const backupContent = await tauriApis.fs.readTextFile(backupPath);
    
    // Create backup of current config before restoring
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const currentBackupPath = `${homeDir}/.config/hypr/hyprland.conf.pre-restore-${timestamp}`;
    
    try {
      const currentConfig = await tauriApis.fs.readTextFile(configPath);
      await tauriApis.fs.writeTextFile(currentBackupPath, currentConfig);
      console.log('Created pre-restore backup:', currentBackupPath);
    } catch (error) {
      console.log('No current config to backup before restore');
    }
    
    // Restore the backup
    await tauriApis.fs.writeTextFile(configPath, backupContent);
    
    // Parse the restored config and update UI
    parseHyprlandConfig(backupContent);
    appState.lastSavedConfig = backupContent;
    appState.hasUnsavedChanges = false;
    updateChangeIndicator();
    
    updateStatusBar(`Backup restored successfully! Pre-restore backup: pre-restore-${timestamp}`);
    
  } catch (error) {
    console.error('Error restoring backup:', error);
    updateStatusBar(`Error restoring backup: ${error.message}`);
  }
}

async function openConfigFileDialog() {
  try {
    if (!tauriApis.dialog) {
      updateStatusBar('File dialog not available');
      return;
    }
    
    const filePath = await tauriApis.dialog.open({
      title: 'Open Hyprland Config',
      multiple: false,
      filters: [
        { name: 'Config Files', extensions: ['conf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (filePath) {
      console.log('Loading config from:', filePath);
      updateStatusBar(`Loading config from ${filePath}...`);
      
      const configContent = await tauriApis.fs.readTextFile(filePath);
      parseHyprlandConfig(configContent);
      
      updateStatusBar(`Config loaded from ${filePath}`);
    }
    
  } catch (error) {
    console.error('Error opening file dialog:', error);
    updateStatusBar(`Error opening file: ${error.message}`);
  }
}

async function saveConfigFileDialog() {
  try {
    if (!tauriApis.dialog) {
      updateStatusBar('File dialog not available');
      return;
    }
    
    const filePath = await tauriApis.dialog.save({
      title: 'Save Hyprland Config',
      defaultPath: 'hyprland.conf',
      filters: [
        { name: 'Config Files', extensions: ['conf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (filePath) {
      console.log('Saving config to:', filePath);
      updateStatusBar(`Saving config to ${filePath}...`);
      
      const configContent = generateHyprlandConfig();
      await tauriApis.fs.writeTextFile(filePath, configContent);
      
      updateStatusBar(`Config exported to ${filePath}`);
    }
    
  } catch (error) {
    console.error('Error saving file:', error);
    updateStatusBar(`Error saving file: ${error.message}`);
  }
}

// Enhanced file operation functions to replace the demo versions
function enhancedLoadConfig() {
  console.log('Enhanced load config called');
  
  if (tauriApis.fs) {
    loadConfigFromFile();
  } else {
    console.log('File API not available, using demo data');
    loadConfig(); // Fall back to demo version
  }
}

function enhancedSaveAsTest() {
  console.log('Enhanced save as test called');
  
  if (tauriApis.fs) {
    saveAsTestFile();
  } else {
    console.log('File API not available, using demo mode');
    saveAsTest(); // Fall back to demo version
  }
}

function enhancedSavePermanently() {
  console.log('Enhanced save permanently called');
  
  if (tauriApis.fs) {
    saveConfigPermanently();
  } else {
    console.log('File API not available, using demo mode');
    savePermanentlyWithBackup(); // Fall back to demo version
  }
}

function enhancedImportConfig() {
  console.log('Enhanced import config called');
  
  if (tauriApis.dialog) {
    openConfigFileDialog();
  } else {
    console.log('Dialog API not available, using raw config tab');
    importConfig(); // Fall back to demo version
  }
}

function enhancedExportConfig() {
  console.log('Enhanced export config called');
  
  if (tauriApis.dialog) {
    saveConfigFileDialog();
  } else {
    console.log('Dialog API not available, using raw config tab');
    exportConfig(); // Fall back to demo version
  }
}

// Function to check if we have real file access
function hasRealFileAccess() {
  return tauriApis.fs !== null && tauriApis.path !== null;
}

// Add this to your initialization code:
// Replace the initializeApp() function with this enhanced version
async function enhancedInitializeApp() {
  console.log('Setting up enhanced app...');
  
  // Initialize Tauri APIs first
  const tauriAvailable = await initializeTauriApis();
  
  if (tauriAvailable) {
    console.log('Real file operations available');
    updateStatusBar('Hyprland Config Editor - Real file mode');
  } else {
    console.log('Running in demo mode');
    updateStatusBar('Hyprland Config Editor - Demo mode');
  }
  
  setupTabSwitching();
  setupKeybindEvents();
  setupEnhancedFileOperations(); // Use enhanced version
  setupGeneralSettings();
  setupBackupSystem();
  
  // Load real config if available, otherwise sample data
  if (tauriAvailable) {
    const loaded = await loadConfigFromFile();
    if (!loaded) {
      loadSampleData();
    }
  } else {
    loadSampleData();
  }
  
  console.log('Enhanced app initialization complete');
}

// Enhanced file operations setup
function setupEnhancedFileOperations() {
  console.log('Setting up enhanced file operations...');
  
  const loadBtn = document.getElementById('load-config');
  const saveBtn = document.getElementById('save-config');
  const exportBtn = document.getElementById('export-config');
  const importBtn = document.getElementById('import-config');
  
  if (loadBtn) {
    loadBtn.addEventListener('click', enhancedLoadConfig);
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      console.log('Enhanced save config clicked');
      showEnhancedSaveOptions();
    });
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', enhancedExportConfig);
  }
  
  if (importBtn) {
    importBtn.addEventListener('click', enhancedImportConfig);
  }
}

function showEnhancedSaveOptions() {
  console.log('Showing enhanced save options...');
  
  if (!appState.hasUnsavedChanges) {
    updateStatusBar('No changes to save');
    return;
  }
  
  const hasFileAccess = hasRealFileAccess();
  const fileMode = hasFileAccess ? 'Real file mode' : 'Demo mode';
  
  const options = [
    `Save as Test File (.test.conf) - ${fileMode}`,
    'Preview Changes',
    `Save Permanently (with backup) - ${fileMode}`,
    'Cancel'
  ];
  
  const choice = prompt(`Choose save option:\n1. ${options[0]}\n2. ${options[1]}\n3. ${options[2]}\n4. ${options[3]}\n\nEnter 1, 2, 3, or 4:`);
  
  switch(choice) {
    case '1':
      enhancedSaveAsTest();
      break;
    case '2':
      previewChanges();
      break;
    case '3':
      enhancedSavePermanently();
      break;
    default:
      updateStatusBar('Save cancelled');
  }
}

// Enhanced Hyprland Config Editor with Backup System
console.log('JavaScript is loading...');

// Application state - this holds all our config data
let appState = {
  keybinds: [],
  monitors: [],
  general: {
    gaps_in: 5,
    gaps_out: 10,
    border_size: 2,
    border_color: '#ffffff'
  },
  rawConfig: '',
  currentFile: null,
  backups: [], // Track available backups
  hasUnsavedChanges: false,
  lastSavedConfig: '' // For comparing changes
};

// Wait for the DOM to load before setting up event listeners
// window.addEventListener("DOMContentLoaded", () => {
//   console.log('DOM loaded, initializing app...');
//   initializeApp();
// });

window.addEventListener("DOMContentLoaded", () => {
  console.log('DOM loaded, initializing enhanced app...');
  enhancedInitializeApp(); // Use the enhanced version
});

function initializeApp() {
  console.log('Setting up app...');
  setupTabSwitching();
  setupKeybindEvents();
  setupFileOperations();
  setupGeneralSettings();
  setupBackupSystem();
  updateStatusBar('Application loaded with backup system');
  
  // Load a sample keybind to show the interface
  loadSampleData();
  console.log('App initialization complete');
}

// Tab switching functionality
function setupTabSwitching() {
  console.log('Setting up tabs...');
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  
  console.log('Found tabs:', tabs.length);
  console.log('Found panels:', panels.length);
  
  tabs.forEach((tab, index) => {
    console.log(`Setting up tab ${index}:`, tab.dataset.tab);
    tab.addEventListener('click', () => {
      console.log('Tab clicked:', tab.dataset.tab);
      
      // Remove active class from all tabs and panels
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Show corresponding panel
      const targetPanel = document.getElementById(tab.dataset.tab + '-tab');
      console.log('Target panel:', targetPanel);
      if (targetPanel) {
        targetPanel.classList.add('active');
        console.log('Panel activated');
        
        // Update raw config when switching to raw tab
        if (tab.dataset.tab === 'raw') {
          updateRawConfig();
        }
      } else {
        console.error('Panel not found for:', tab.dataset.tab + '-tab');
      }
      
      updateStatusBar(`Switched to ${tab.textContent} tab`);
    });
  });
}

// Keybind management functions
function setupKeybindEvents() {
  console.log('Setting up keybind events...');
  const addKeybindBtn = document.getElementById('add-keybind');
  const saveKeybindBtn = document.getElementById('save-keybind');
  const cancelKeybindBtn = document.getElementById('cancel-keybind');
  const keybindForm = document.getElementById('keybind-form');
  
  console.log('Add keybind button:', addKeybindBtn);
  console.log('Save keybind button:', saveKeybindBtn);
  console.log('Keybind form:', keybindForm);
  
  if (addKeybindBtn) {
    addKeybindBtn.addEventListener('click', () => {
      console.log('Add keybind button clicked');
      if (keybindForm) {
        keybindForm.style.display = 'block';
        clearKeybindForm();
        updateStatusBar('Adding new keybind');
      }
    });
  }
  
  if (saveKeybindBtn) {
    saveKeybindBtn.addEventListener('click', () => {
      console.log('Save keybind button clicked');
      saveKeybind();
    });
  }
  
  if (cancelKeybindBtn) {
    cancelKeybindBtn.addEventListener('click', () => {
      console.log('Cancel keybind button clicked');
      if (keybindForm) {
        keybindForm.style.display = 'none';
        updateStatusBar('Cancelled keybind creation');
      }
    });
  }
  
  // Update action field based on action type
  const actionType = document.getElementById('action-type');
  const actionField = document.getElementById('action');
  
  if (actionType && actionField) {
    actionType.addEventListener('change', () => {
      const type = actionType.value;
      console.log('Action type changed to:', type);
      switch(type) {
        case 'exec':
          actionField.placeholder = 'e.g., kitty, firefox, code';
          break;
        case 'workspace':
          actionField.placeholder = 'e.g., 1, 2, 3';
          break;
        case 'movetoworkspace':
          actionField.placeholder = 'e.g., 1, 2, 3';
          break;
        case 'killactive':
          actionField.value = '';
          actionField.placeholder = 'No additional action needed';
          break;
        case 'togglefloating':
          actionField.value = '';
          actionField.placeholder = 'No additional action needed';
          break;
        case 'fullscreen':
          actionField.value = '1';
          actionField.placeholder = '0 = maximize, 1 = fullscreen';
          break;
        default:
          actionField.placeholder = 'Enter custom command';
      }
    });
  }
}

function saveKeybind() {
  console.log('Saving keybind...');
  const modifiersSelect = document.getElementById('modifiers');
  const keyInput = document.getElementById('key');
  const actionTypeSelect = document.getElementById('action-type');
  const actionInput = document.getElementById('action');
  
  if (!modifiersSelect || !keyInput || !actionTypeSelect || !actionInput) {
    console.error('Form elements not found');
    updateStatusBar('Error: Form elements not found');
    return;
  }
  
  // Get selected modifiers
  const selectedModifiers = Array.from(modifiersSelect.selectedOptions)
    .map(option => option.value);
  
  console.log('Selected modifiers:', selectedModifiers);
  console.log('Key:', keyInput.value);
  
  if (selectedModifiers.length === 0 || !keyInput.value.trim()) {
    updateStatusBar('Error: Please select modifiers and enter a key');
    return;
  }
  
  // Create keybind object
  const keybind = {
    id: Date.now(), // Simple ID generation
    modifiers: selectedModifiers,
    key: keyInput.value.trim(),
    actionType: actionTypeSelect.value,
    action: actionInput.value.trim()
  };
  
  console.log('Created keybind:', keybind);
  
  // Add to app state
  appState.keybinds.push(keybind);
  markAsChanged();
  
  // Update display
  renderKeybinds();
  
  // Hide form
  document.getElementById('keybind-form').style.display = 'none';
  
  updateStatusBar(`Keybind added: ${formatKeybindCombo(keybind)}`);
}

function renderKeybinds() {
  console.log('Rendering keybinds...');
  const container = document.getElementById('keybinds-list');
  
  if (!container) {
    console.error('Keybinds container not found');
    return;
  }
  
  if (appState.keybinds.length === 0) {
    container.innerHTML = '<p class="placeholder">No keybinds configured. Click "Add Keybind" to create one.</p>';
    return;
  }
  
  console.log('Rendering', appState.keybinds.length, 'keybinds');
  
  container.innerHTML = appState.keybinds.map(keybind => `
    <div class="keybind-item" data-id="${keybind.id}">
      <div class="keybind-info">
        <span class="keybind-combo">${formatKeybindCombo(keybind)}</span>
        <div class="keybind-action">${formatKeybindAction(keybind)}</div>
      </div>
      <div class="keybind-controls">
        <button class="btn-small btn-edit" onclick="editKeybind(${keybind.id})">Edit</button>
        <button class="btn-small btn-delete" onclick="deleteKeybind(${keybind.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function formatKeybindCombo(keybind) {
  const combo = keybind.modifiers.join(' + ') + ' + ' + keybind.key;
  return combo;
}

function formatKeybindAction(keybind) {
  switch(keybind.actionType) {
    case 'exec':
      return `Launch: ${keybind.action}`;
    case 'workspace':
      return `Switch to workspace ${keybind.action}`;
    case 'movetoworkspace':
      return `Move to workspace ${keybind.action}`;
    case 'killactive':
      return 'Close active window';
    case 'togglefloating':
      return 'Toggle floating mode';
    case 'fullscreen':
      return keybind.action === '1' ? 'Toggle fullscreen' : 'Toggle maximize';
    default:
      return keybind.action;
  }
}

function deleteKeybind(id) {
  console.log('Deleting keybind:', id);
  if (confirm('Are you sure you want to delete this keybind?')) {
    appState.keybinds = appState.keybinds.filter(kb => kb.id !== id);
    markAsChanged();
    renderKeybinds();
    updateStatusBar('Keybind deleted');
  }
}

function editKeybind(id) {
  console.log('Editing keybind:', id);
  const keybind = appState.keybinds.find(kb => kb.id === id);
  if (!keybind) return;
  
  // Populate form with existing data
  const modifiersSelect = document.getElementById('modifiers');
  const keyInput = document.getElementById('key');
  const actionTypeSelect = document.getElementById('action-type');
  const actionInput = document.getElementById('action');
  
  // Clear previous selections
  Array.from(modifiersSelect.options).forEach(option => option.selected = false);
  
  // Set current values
  keybind.modifiers.forEach(mod => {
    const option = Array.from(modifiersSelect.options).find(opt => opt.value === mod);
    if (option) option.selected = true;
  });
  
  keyInput.value = keybind.key;
  actionTypeSelect.value = keybind.actionType;
  actionInput.value = keybind.action;
  
  // Show form
  document.getElementById('keybind-form').style.display = 'block';
  
  // Remove the old keybind (we'll add the updated one when saved)
  appState.keybinds = appState.keybinds.filter(kb => kb.id !== id);
  
  updateStatusBar('Editing keybind - make changes and click Save');
}

function clearKeybindForm() {
  console.log('Clearing keybind form...');
  const modifiersSelect = document.getElementById('modifiers');
  const keyInput = document.getElementById('key');
  const actionTypeSelect = document.getElementById('action-type');
  const actionInput = document.getElementById('action');
  
  if (modifiersSelect) modifiersSelect.selectedIndex = -1;
  if (keyInput) keyInput.value = '';
  if (actionTypeSelect) actionTypeSelect.value = 'exec';
  if (actionInput) actionInput.value = '';
}

// Enhanced file operations with backup system
function setupFileOperations() {
  console.log('Setting up file operations...');
  const loadBtn = document.getElementById('load-config');
  const saveBtn = document.getElementById('save-config');
  const exportBtn = document.getElementById('export-config');
  const importBtn = document.getElementById('import-config');
  
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      console.log('Load config clicked');
      loadConfig();
    });
  }
  
  if (saveBtn) {
    // Change save button behavior - now shows save options
    saveBtn.addEventListener('click', () => {
      console.log('Save config clicked');
      showSaveOptions();
    });
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      console.log('Export config clicked');
      exportConfig();
    });
  }
  
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      console.log('Import config clicked');
      importConfig();
    });
  }
}

function showSaveOptions() {
  console.log('Showing save options...');
  
  if (!appState.hasUnsavedChanges) {
    updateStatusBar('No changes to save');
    return;
  }
  
  const options = [
    'Save as Test File (.test.conf)',
    'Preview Changes',
    'Save Permanently (with backup)',
    'Cancel'
  ];
  
  // For demo, we'll use a simple confirm - in a real app, use a proper modal
  const choice = prompt(`Choose save option:\n1. ${options[0]}\n2. ${options[1]}\n3. ${options[2]}\n4. ${options[3]}\n\nEnter 1, 2, 3, or 4:`);
  
  switch(choice) {
    case '1':
      saveAsTest();
      break;
    case '2':
      previewChanges();
      break;
    case '3':
      savePermanentlyWithBackup();
      break;
    default:
      updateStatusBar('Save cancelled');
  }
}

function saveAsTest() {
  console.log('Saving as test file...');
  const configContent = generateHyprlandConfig();
  
  // In real app, save to ~/.config/hypr/hyprland.test.conf
  console.log('Would save to: ~/.config/hypr/hyprland.test.conf');
  console.log('Test config content:', configContent);
  
  document.getElementById('raw-config').value = configContent;
  updateStatusBar('Saved as test file - check Raw Config tab. Test with "hyprctl reload"');
  
  // Switch to raw config tab to show the result
  document.querySelector('[data-tab="raw"]').click();
}

function previewChanges() {
  console.log('Previewing changes...');
  const currentConfig = generateHyprlandConfig();
  const lastSaved = appState.lastSavedConfig || generateSampleConfig();
  
  // Simple diff display - in real app, use a proper diff library
  const modal = createPreviewModal(lastSaved, currentConfig);
  document.body.appendChild(modal);
  
  updateStatusBar('Showing config preview');
}

function savePermanentlyWithBackup() {
  console.log('Saving permanently with backup...');
  
  if (!confirm('This will:\n1. Create backup of current config\n2. Replace main hyprland.conf\n\nContinue?')) {
    updateStatusBar('Save cancelled');
    return;
  }
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const backupName = `hyprland.conf.backup-${timestamp}`;
  
  console.log('Would create backup:', backupName);
  console.log('Would save new config to: ~/.config/hypr/hyprland.conf');
  
  // Simulate successful backup and save
  const newConfig = generateHyprlandConfig();
  appState.lastSavedConfig = newConfig;
  appState.hasUnsavedChanges = false;
  
  // Add to backup list
  appState.backups.unshift({
    name: backupName,
    timestamp: new Date(),
    size: newConfig.length
  });
  
  updateBackupsList();
  updateChangeIndicator();
  updateStatusBar(`Config saved! Backup created: ${backupName}`);
}

function createPreviewModal(oldConfig, newConfig) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.8); z-index: 1000;
    display: flex; align-items: center; justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 20px; border-radius: 8px;
    max-width: 90%; max-height: 90%; overflow: auto;
    color: black;
  `;
  
  content.innerHTML = `
    <h2>Config Changes Preview</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <h3>Current Config</h3>
        <pre style="background: #f5f5f5; padding: 10px; font-size: 12px; overflow: auto; max-height: 300px;">${oldConfig}</pre>
      </div>
      <div>
        <h3>New Config</h3>
        <pre style="background: #e8f5e8; padding: 10px; font-size: 12px; overflow: auto; max-height: 300px;">${newConfig}</pre>
      </div>
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <button onclick="this.closest('[style*=fixed]').remove()" style="padding: 10px 20px; margin: 0 10px;">Close</button>
      <button onclick="savePermanentlyWithBackup(); this.closest('[style*=fixed]').remove();" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px;">Save Permanently</button>
    </div>
  `;
  
  modal.appendChild(content);
  return modal;
}

// Backup system functions
function setupBackupSystem() {
  console.log('Setting up backup system...');
  
  // Add backup list to the UI (we'll inject it into the General tab)
  const generalTab = document.getElementById('general-tab');
  if (generalTab) {
    const backupSection = document.createElement('div');
    backupSection.innerHTML = `
      <div class="setting-group">
        <h3>Configuration Backups</h3>
        <div id="backups-list" class="backups-container">
          <p class="placeholder">No backups yet. Save your config to create backups.</p>
        </div>
        <div style="margin-top: 10px;">
          <button id="cleanup-backups" class="btn-secondary">Clean Old Backups</button>
        </div>
      </div>
    `;
    generalTab.appendChild(backupSection);
    
    // Setup cleanup button
    document.getElementById('cleanup-backups').addEventListener('click', cleanupOldBackups);
  }
  
  updateChangeIndicator();
}

function updateBackupsList() {
  const container = document.getElementById('backups-list');
  if (!container) return;
  
  if (appState.backups.length === 0) {
    container.innerHTML = '<p class="placeholder">No backups yet. Save your config to create backups.</p>';
    return;
  }
  
  container.innerHTML = appState.backups.map(backup => `
    <div class="backup-item" style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong>${backup.name}</strong><br>
        <small style="color: #666;">${backup.timestamp.toLocaleString()} • ${backup.size} bytes</small>
      </div>
      <div>
        <button class="btn-small btn-secondary" onclick="restoreBackup('${backup.name}')">Restore</button>
        <button class="btn-small btn-delete" onclick="deleteBackup('${backup.name}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function cleanupOldBackups() {
  const keepCount = 5; // Keep last 5 backups
  if (appState.backups.length <= keepCount) {
    updateStatusBar(`Only ${appState.backups.length} backups exist, no cleanup needed`);
    return;
  }
  
  const toDelete = appState.backups.length - keepCount;
  if (confirm(`Delete ${toDelete} old backups? (Keeping newest ${keepCount})`)) {
    appState.backups = appState.backups.slice(0, keepCount);
    updateBackupsList();
    updateStatusBar(`Cleaned up ${toDelete} old backups`);
  }
}

function restoreBackup(backupName) {
  if (confirm(`Restore backup: ${backupName}?\n\nThis will replace your current configuration.`)) {
    console.log('Would restore backup:', backupName);
    updateStatusBar(`Backup ${backupName} restored`);
    // In real app, load the backup file and parse it
  }
}

function deleteBackup(backupName) {
  if (confirm(`Delete backup: ${backupName}?`)) {
    appState.backups = appState.backups.filter(backup => backup.name !== backupName);
    updateBackupsList();
    updateStatusBar(`Backup ${backupName} deleted`);
  }
}

function markAsChanged() {
  appState.hasUnsavedChanges = true;
  updateChangeIndicator();
}

function updateChangeIndicator() {
  const saveBtn = document.getElementById('save-config');
  if (saveBtn) {
    if (appState.hasUnsavedChanges) {
      saveBtn.textContent = 'Save Config *';
      saveBtn.style.fontWeight = 'bold';
    } else {
      saveBtn.textContent = 'Save Config';
      saveBtn.style.fontWeight = 'normal';
    }
  }
}

function loadConfig() {
  console.log('Loading config...');
  const configContent = generateSampleConfig();
  parseHyprlandConfig(configContent);
  appState.lastSavedConfig = configContent;
  appState.hasUnsavedChanges = false;
  updateChangeIndicator();
  updateStatusBar('Sample config loaded');
}

function exportConfig() {
  console.log('Exporting config...');
  const configContent = generateHyprlandConfig();
  document.getElementById('raw-config').value = configContent;
  
  // Switch to raw config tab
  const rawTab = document.querySelector('[data-tab="raw"]');
  if (rawTab) {
    rawTab.click();
  }
  
  updateStatusBar('Config exported to Raw Config tab');
}

function importConfig() {
  console.log('Import config clicked');
  updateStatusBar('Import functionality - paste config in Raw Config tab and click Parse');
  
  // Add parse button functionality
  const parseBtn = document.getElementById('parse-raw');
  if (parseBtn) {
    parseBtn.addEventListener('click', () => {
      const rawConfig = document.getElementById('raw-config').value;
      if (rawConfig.trim()) {
        parseHyprlandConfig(rawConfig);
        updateStatusBar('Config parsed from Raw Config tab');
      }
    });
  }
}

function updateRawConfig() {
  const rawConfigArea = document.getElementById('raw-config');
  if (rawConfigArea) {
    rawConfigArea.value = generateHyprlandConfig();
  }
}

// Config parsing and generation
function parseHyprlandConfig(configText) {
  console.log('Parsing Hyprland config...');
  appState.rawConfig = configText;
  appState.keybinds = [];
  
  // Parse bind statements
  const bindRegex = /bind\s*=\s*([^,]+),\s*([^,]+),\s*(.*)/g;
  let match;
  
  while ((match = bindRegex.exec(configText)) !== null) {
    const modifiersStr = match[1].trim();
    const key = match[2].trim();
    const action = match[3].trim();
    
    // Parse modifiers
    const modifiers = modifiersStr.split(/\s*\+\s*/).filter(m => m);
    
    // Determine action type
    let actionType = 'custom';
    if (action.startsWith('exec,')) {
      actionType = 'exec';
    } else if (action === 'killactive') {
      actionType = 'killactive';
    } else if (action.startsWith('workspace,')) {
      actionType = 'workspace';
    }
    
    appState.keybinds.push({
      id: Date.now() + Math.random(),
      modifiers,
      key,
      actionType,
      action: action.replace(/^(exec|workspace),\s*/, '')
    });
  }
  
  renderKeybinds();
  
  const rawConfigArea = document.getElementById('raw-config');
  if (rawConfigArea) {
    rawConfigArea.value = configText;
  }
  
  markAsChanged();
}

function generateHyprlandConfig() {
  console.log('Generating Hyprland config...');
  let config = '# Hyprland Configuration\n';
  config += `# Generated by Hyprland Config Editor on ${new Date().toLocaleString()}\n\n`;
  
  // General settings
  config += '# General configuration\n';
  config += 'general {\n';
  config += `    gaps_in = ${appState.general.gaps_in}\n`;
  config += `    gaps_out = ${appState.general.gaps_out}\n`;
  config += `    border_size = ${appState.general.border_size}\n`;
  config += `    col.active_border = rgba(${hexToRgba(appState.general.border_color)})\n`;
  config += '}\n\n';
  
  // Keybinds
  config += '# Keybinds\n';
  appState.keybinds.forEach(keybind => {
    const modifiers = keybind.modifiers.join(' + ');
    let action = keybind.action;
    
    if (keybind.actionType === 'exec') {
      action = `exec, ${action}`;
    } else if (keybind.actionType === 'workspace') {
      action = `workspace, ${action}`;
    } else if (keybind.actionType === 'movetoworkspace') {
      action = `movetoworkspace, ${action}`;
    }
    
    config += `bind = ${modifiers}, ${keybind.key}, ${action}\n`;
  });
  
  config += '\n# End of configuration\n';
  return config;
}

// General settings
function setupGeneralSettings() {
  console.log('Setting up general settings...');
  const inputs = ['gaps-in', 'gaps-out', 'border-size', 'border-color'];
  
  inputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('change', () => {
        updateGeneralSettings();
        markAsChanged();
      });
      console.log('Set up listener for:', inputId);
    } else {
      console.log('Input not found:', inputId);
    }
  });
}

function updateGeneralSettings() {
  console.log('Updating general settings...');
  const gapsIn = document.getElementById('gaps-in');
  const gapsOut = document.getElementById('gaps-out');
  const borderSize = document.getElementById('border-size');
  const borderColor = document.getElementById('border-color');
  
  if (gapsIn) appState.general.gaps_in = parseInt(gapsIn.value) || 5;
  if (gapsOut) appState.general.gaps_out = parseInt(gapsOut.value) || 10;
  if (borderSize) appState.general.border_size = parseInt(borderSize.value) || 2;
  if (borderColor) appState.general.border_color = borderColor.value || '#ffffff';
  
  updateStatusBar('General settings updated');
}

// Utility functions
function updateStatusBar(message) {
  const statusText = document.getElementById('status-text');
  if (statusText) {
    statusText.textContent = message;
  }
  console.log('Status:', message);
}

function hexToRgba(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}, 255`;
}

function loadSampleData() {
  console.log('Loading sample data...');
  // Add some sample keybinds to show the interface
  appState.keybinds = [
    {
      id: 1,
      modifiers: ['SUPER'],
      key: 'Q',
      actionType: 'exec',
      action: 'kitty'
    },
    {
      id: 2,
      modifiers: ['SUPER', 'SHIFT'],
      key: 'C',
      actionType: 'killactive',
      action: ''
    },
    {
      id: 3,
      modifiers: ['SUPER'],
      key: '1',
      actionType: 'workspace',
      action: '1'
    }
  ];
  
  renderKeybinds();
  appState.lastSavedConfig = generateHyprlandConfig();
  updateChangeIndicator();
  updateStatusBar('Sample data loaded with backup system');
}

function generateSampleConfig() {
  return `# Example Hyprland Configuration

general {
    gaps_in = 5
    gaps_out = 10
    border_size = 2
    col.active_border = rgba(255, 255, 255, 255)
}

# Keybinds
bind = SUPER, Q, exec, kitty
bind = SUPER SHIFT, C, killactive
bind = SUPER, 1, workspace, 1
bind = SUPER, 2, workspace, 2
bind = SUPER, F, togglefloating

# Window rules
windowrule = float, ^(kitty)$
`;
}
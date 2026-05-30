# ==============================================================================
# VEIL STUDIO - CUSTOM INSTALLER SCRIPT
# ==============================================================================

!include "MUI2.nsh"
!include "TextFunc.nsh"

# These variables are automatically injected by the Tauri build process
!define MUI_ICON "${PRODUCT_ICON}"
!define MUI_UNICON "${PRODUCT_UNINSTALL_ICON}"

# ==============================================================================
# UI PAGE DEFINITIONS & TEXT
# ==============================================================================

# Welcome Page
!define MUI_WELCOMEPAGE_TITLE "Greetings, fair Valentina!"
!define MUI_WELCOMEPAGE_TEXT "Pray, attend!$\r$\n$\r$\nThis humble wizard shall assist in bestowing Veil Studio upon thy machine.$\r$\n$\r$\nShall we commence this noble endeavor? Click Next to proceed."
!insertmacro MUI_PAGE_WELCOME

# Directory Selection Page
!define MUI_DIRECTORYPAGE_TEXT_TOP "Choose the sanctum where thou wishest to house Veil Studio."
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Destination Folder"
!insertmacro MUI_PAGE_DIRECTORY

# Installation Progress Page
!define MUI_TEXT_INSTALLING_TITLE "The Crafting Commences"
!define MUI_TEXT_INSTALLING_SUBTITLE "Have patience, fair maiden, whilst the gears turn and the installation is perfected."
!insertmacro MUI_PAGE_INSTFILES

# Finish Page
!define MUI_FINISHPAGE_TITLE "The Task is Accomplished!"
!define MUI_FINISHPAGE_TEXT "By thy grace, the work is done.$\r$\n$\r$\nVeil Studio is now firmly established upon thy device. Click Finish to conclude this quest."
!insertmacro MUI_PAGE_FINISH

# ==============================================================================
# UNINSTALLER SEQUENCE
# ==============================================================================
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

# ==============================================================================
# BUTTON LABEL OVERRIDES
# ==============================================================================
!define MUI_BUTTONTEXT_BACK "<< Verily, Back"
!define MUI_BUTTONTEXT_NEXT "Proceed &Next >>"
!define MUI_BUTTONTEXT_INSTALL "Begin &Installation"
!define MUI_BUTTONTEXT_CANCEL "Cease"
!define MUI_BUTTONTEXT_FINISH "Huzzah! &Finish"

# ==============================================================================
# FINAL CONFIGURATION
# ==============================================================================
!insertmacro MUI_LANGUAGE "English"
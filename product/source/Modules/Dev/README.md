# DEV tests

Opcjonalny moduł dev: żywa galeria wspólnych komponentów, niezależna od Notatnika.

- Windows/WPF: ActionButton, DropDownMenu, MenuBar, ToolPanel, TabCard, CompositePanel i DialogService.
- Edytor/Web: ActionButton, ToolPanel, DropDownMenu (akcje, wybór, sugestie, PPM), TextField, Toggle, Label, Dialog, Handle, VisualElement i VisualRegistry.
- Przykłady pokazują wynik interakcji, stany wyłączone i zaznaczone oraz menu w oknie modalnym.
- Galeria nie czyta ani nie zmienia notatek. Okno zapisu tylko wybiera ścieżkę; nic nie zapisuje.
- Zasoby/cache galerii: %LOCALAPPDATA%/Notarium/dev-gallery.

Budowanie: npm ci i npm run build w WebGallery, następnie projekt Notarium.Dev.csproj. npm test sprawdza interakcje webowe. Tests/Dev/Notarium.DevTests.csproj sprawdza kontrakt, kompozycję WPF i rzeczywisty start WebView2.

DEV można usunąć jak każdy moduł: cały katalog wydania i ponowne uruchomienie. Pozycja w panelu pozostaje i informuje o braku implementacji.

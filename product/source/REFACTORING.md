# Notarium: granice kodu

## Architektura

- `Shell/MainPanel.cs`: główny panel programu. Zna wyłącznie kontrakt modułu, nie typy ani dane Notatnika.
- `Shell/ModuleCatalog.cs`: wykrywa implementacje `INotariumModule` w `Modules/*/Notarium.*.dll`. Brak modułów jest poprawnym stanem. Błędny moduł jest pomijany i raportowany.
- `Shared/Contracts`: kontrakt uruchamiania modułów; nie jest zapleczem danych.
- `Shared/UI`: komponenty WPF, menu, dialogi i wspólny motyw.
- `Shared/Web/UI`: komponenty edytora webowego, menu i rejestr wizualnych elementów.
- `Shared/WebHost`: jednorazowa inicjalizacja WebView2 współdzielona przez Notatnik i DEV; powłoka nie zależy od tej biblioteki.
- `Shared/UI/ui-policy.json`: jedna polityka wyglądu menu, odczytywana przez obie implementacje.
- `Modules/Notebook`: niezależny projekt biblioteki z dotychczasowym Notatnikiem. Powłoka nie ma odwołania projektowego do niego.

## Notatnik

`MainWindow.xaml.cs` jest miejscem kompozycji i obsługi cyklu życia okna. Nie zarządza samodzielnie algorytmem paginacji, biblioteką ani timerem zapisu.

- `Services/NotebookLibrary.cs`: kolekcja notatek, import, zmiana nazw, ulubione, usuwanie i zapis.
- `Services/NotebookTabs.cs`: otwarte karty, aktywacja, szerokości i paginacja.
- `Services/NotebookAutosave.cs`: harmonogram automatycznego zapisu.
- `Services/NotebookRuntime.cs`: inicjalizacja natywnych zależności WebView2 z katalogu modułu, bez zależności powłoki od Notatnika.
- `Services/NotebookFormatting.cs`: polecenia formatowania i definicje wyborów; aktualizuje widok przez przekazane callbacki, bez zależności od MainWindow.
- `Controls/NotebookLibraryPanel.xaml` i `NotebookTabsPanel.xaml`: własne widoki i zdarzenia panelu biblioteki oraz kart.
- `MainWindow.ViewRouting.cs`, `Views/MainWindow.*.cs`: adaptery zdarzeń widoków i połączenie z usługami.
- `Core`: pomocnicze mechanizmy i konwersje dokumentów Notatnika. Modele Note/OpenNote i magazyn NoteStore są w katalogu głównym modułu.

## Kontenery i prezentacja

- `WebEditor/src/containers.js`: operacje dokumentu, wybór, schowek, granice i gesty zmiany układu.
- `WebEditor/src/container-interactions.js`: adapter zdarzeń myszy i klawiatury. Przyciski mają pierwszeństwo przed przechwytywaniem kliknięć w szczeliny.
- `WebEditor/src/container-visual.js`: budowanie paneli, podświetlenia, pozycjonowanie i renderowanie wymiarów oraz podglądu gestów.
- `WebEditor/src/container-types.js`: osobne klasy polityk dla Text, Empty, nagłówka, cytatu, list, Code Block, Code Cell, obrazu, matematyki, tabeli i grupy. Typy określają etykiety, minimalne rozmiary, początkową zawartość i atrybuty kopiowania.
- `WebEditor/src/containers.css`: wygląd kontenerów i uchwytów.

Empty jest wariantem Text, nie osobnym formatem przechowywania. Po wpisaniu treści zachowuje się jak Text. Jego minimalna szerokość nie blokuje wspólnego zmniejszania sąsiedniej pary.

## Wspólne elementy wizualne

WPF i WebView mają dwa różne środowiska wykonania; nie mogą współdzielić jednej klasy wykonawczej. Każde środowisko ma jedną implementację danego wspólnego komponentu, a menu używają tej samej polityki wizualnej.

- WPF `DropDownMenu` renderuje listy paska File/Edit/View/Help, wyboru fontu, koloru, odstępów, szerokości, zoomu i menu kart. `MenuItem` pozostaje definicją akcji, nie renderuje natywnego popupu. Menu jest zakotwiczone do przycisku.
- Web `DropDownMenu` renderuje wybory formularzy, menu obrazu i sugestie języka komórki kodu. Natywne selecty przechowują stan formularza, ale nie wyświetlają własnych list.
- `ActionButton`, `ToolPanel`, `TabCard` i złożone panele mają własne komponenty WPF. Web ma odpowiedniki przycisków, paneli, pól, etykiet, uchwytów i dialogów; `VisualRegistry` obejmuje też elementy tworzone dynamicznie.
- `DialogService` jest wspólnym wejściem do systemowych komunikatów, wyboru pliku i koloru. Webowy `Dialog` centralizuje cykl otwierania formularzy.

Elementy wewnętrzne Tiptap, CodeMirror, Cropper i renderera matematyki pozostają własnością tych silników. Nie zastępujemy ich sztucznymi klasami Notarium. Systemowy wybór pliku/koloru pozostaje natywnym dialogiem.

## Opcjonalne moduły i dane

Istnieją działające moduły Notatnik i DEV tests. Kalendarz, Kolekcje i Prompting mają katalogi z opisami, bez implementacji. Wszystkie pięć pozycji jest widocznych w panelu; brak implementacji daje czytelny komunikat. Dodatkowy wykryty moduł jest również dodawany do listy. Nowy moduł implementuje `INotariumModule`, ma osobny projekt i własny katalog w wydaniu.

Usunięcie całego `Modules/Notebook` ze źródeł pozwala budować powłokę. Usunięcie go z wydania pozwala uruchomić powłokę bez Notatnika. Wspólne Contracts/UI należą do aplikacji, nie do modułu. Zmiany zestawu modułów obowiązują po ponownym uruchomieniu; nie ma hot-unload.

Notatnik nadal otwiera własne okno. Ścieżka danych użytkownika pozostaje niezmieniona: `%LOCALAPPDATA%/Notatnik/notes.json`. Nie powstała wspólna baza, linkowanie ani inteligentne zaplecze.

## Budowanie i testy

`build.ps1` buduje edytor i galerię DEV, uruchamia ich testy webowe i natywne, a następnie publikuje lokalny pakiet. Kroki każdego modułu są pomijane, gdy nie ma jego projektu. Publikacja wykrywa projekty `Modules/*/Notarium.*.csproj`, bez odwołań projektowych powłoki do konkretnych modułów.

Osobno:
- `npm run build`, `node ui-test.mjs`, `npm test` w katalogu WebEditor.
- `dotnet run --project Tests/Notarium.ArchitectureTests.csproj -c Release` dla kontrolerów, menu i rzeczywistej kompozycji XAML w izolowanych danych testowych.
- Ten sam zestaw uruchamia prawdziwe WebView2 w izolowanym katalogu i czeka na sygnał gotowości edytora.
- `./build.ps1` jest standardową drogą do jednego bieżącego `product/builds/Notarium`. Publikuje do Temp, weryfikuje moduły i dopiero po sukcesie wymienia aktualny pakiet. Nie tworzymy katalogów final/verified ani katalogów nazwanych commitami.
- `Notarium.exe --check-modules <raport.json>` sprawdza wykrywanie modułów bez otwierania danych użytkownika.

Weryfikacja obejmuje także świeżą kopię źródeł powłoki bez plików modułu i uruchomienie wydania bez katalogu Modules. Wyniki końcowej weryfikacji są w `operations/tests/refactor-20260926.md`.

Pełny przewodnik: `C:/NOTARIUM/product/documentation/ARCHITECTURE.md`. Status modułów i DEV: `C:/NOTARIUM/product/documentation/MODULES.md`.

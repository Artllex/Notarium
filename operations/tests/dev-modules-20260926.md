# Moduły i DEV — weryfikacja 2026-09-26

Źródła: C:/NOTARIUM/product/source.
Finalny pakiet: C:/NOTARIUM/product/builds/Notarium-DEV-final-20260926/Notarium.exe.

## Dokumentacja

- product/documentation/README.md: indeks.
- product/documentation/ARCHITECTURE.md: pełny przewodnik po katalogach, odpowiedzialnościach, danych i przepływie zmian.
- product/documentation/MODULES.md: status modułów, galeria i zasady rozszerzania.
- source/REFACTORING.md i opis silnika Notatnika zostały zaktualizowane, w tym nieaktualne ścieżki budowania.

## Implementacja

- Utworzono Modules/Calendar, Collections, Prompting z README. Bez projektów udających gotową funkcjonalność.
- Wszystkie pięć znanych pozycji pozostaje widocznych bez implementacji. Brak modułu daje informację, nie awarię.
- DEV jest prawdziwym opcjonalnym modułem. Ma galerie Windows/WPF i Edytor/Web, używające rzeczywistych wspólnych komponentów.
- WebView2 jest inicjalizowany wspólnym ModuleWebRuntime, aby otwieranie dwóch modułów nie konfigurowało drugi raz załadowanego loadera.
- Publikacja wykrywa projekty modułów automatycznie. Kroki budowania/testów DEV są warunkowe w build.ps1.

## Wyniki

- PASS: 5 scenariuszy webowych DEV: komponenty, dropdown/klawiatura/wyłączenie/pozycja, wybór/sugestie, PPM/dialog, pola/toggle/handle/dynamiczne kontrolki.
- PASS: 5 natywnych testów DEV: znane pozycje bez plików, normalny stan braku implementacji, kontrakt, rzeczywiste komponenty WPF i sygnał gotowości WebView2 w izolowanych danych.
- PASS: 18 dotychczasowych testów architektury Notatnika po zmianie runtime, w tym prawdziwy start edytora. Pełne 42 scenariusze edytora nie były ponownie uruchamiane w tym rozszerzeniu; ich wynik z refaktoryzacji jest w osobnym raporcie. Kod JS edytora Notatnika nie był tutaj zmieniany.
- PASS: publikacja powłoki i dwóch modułów w kanonicznych katalogach Modules/Dev i Modules/Notebook.
- PASS: katalog finalnego wydania zawiera dev/notebook, pięć widocznych pozycji i errors: []. Dowód: dev-catalog-20260926.json.
- PASS: wszystkie pięć przycisków w rzeczywistym panelu.
- PASS: kliknięcie Kalendarza pokazuje Brak modułu z tekstem Brakuje modułu Kalendarz; komunikat można zamknąć, aplikacja działa dalej.
- PASS: rzeczywiste okno DEV, zakładka webowa z uruchomioną galerią i otwarcie Notatnika po DEV bez błędu ponownej konfiguracji WebView2.
- PASS: świeża kopia źródeł bez żadnego pliku Notatnika buduje powłokę i DEV; uruchomienie wykrywa tylko dev i żadnych błędów. Fixture: product/environment/dev-without-notebook-20260926. Dowód: dev-only-catalog-20260926.json.

Finalna aplikacja i DEV pozostawione otwarte; PID w momencie sprawdzenia: 60712.

Galerię należy traktować jako żywe próbki i pomoc ręcznych testów, nie gwarancję braku wszystkich błędów. Nie utworzono przyszłego zaplecza danych i nie zmieniono danych notatek w ramach galerii. Kontrola natywna poza izolowanymi testami otworzyła dotychczasowy Notatnik bez edycji treści.

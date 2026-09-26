# Praca nad Notarium

- Kanoniczne repozytorium jest w C:/NOTARIUM; kod w product/source. Zachowuj historię Git, nie inicjalizuj kolejnych niezależnych repozytoriów.
- Zmiany zapisuj jako logiczne commity. Nie używaj kopii kodu ani folderów final/verified do wersjonowania. Nie wykonuj push bez żądania użytkownika.
- Jedyny bieżący build: product/builds/Notarium. Wybrane wydania w releases tylko po świadomym żądaniu wydania.
- Build i warianty testów przygotowuj w systemowym Temp, sprzątaj po sprawdzeniu. Nie zostawiaj dodatkowych katalogów w builds/environment.
- Korzystaj z product/source/build.ps1: testuje, publikuje do Temp, weryfikuje moduły i zastępuje bieżący build dopiero po sukcesie. Błąd przed wymianą nie może uszkodzić poprzedniego buildu.
- Nie nadpisuj ani nie przerywaj działającej aplikacji bez bezpiecznego zamknięcia; nie zabijaj procesu z niezapisanymi notatkami.
- Po zakończeniu edycji otwórz aktualną aplikację dla użytkownika.
- Przy porządkowaniu artefaktów sprawdzaj pełne ścieżki. Preferuj Kosz; nie usuwaj źródeł, danych użytkownika ani historii Git.
- Aktualizuj product/documentation wraz ze zmianą architektury. Testy automatyczne i ręczne wyniki opisuj uczciwie, bez utożsamiania buildu z działającą funkcją.

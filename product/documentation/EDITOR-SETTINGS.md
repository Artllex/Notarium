# Ustawienia edytora: inwentaryzacja i nowe miejsca obsługi

## Dotychczasowe okienka edytora

1. Układ (`page-layout-dialog`): podział na strony, szerokość obszaru, A3/A4/A5/Letter/Legal, orientacja, kolor, marginesy, wcięcia, odstępy, zakres akapit/domyslne notatki, dzielenie wyrazów, stopka, odległość stopki, numeracja i numer początkowy.
2. Link (`link-dialog`): adres odnośnika, zapis i anulowanie.
3. Math (`math-dialog`): LaTeX, wzór w tekście/osobnym wierszu, automatyczna numeracja, podgląd, walidacja, wstawianie/edycja.
4. Obraz (`image-dialog`): szerokość, tytuł, stopka, rozpoczęcie kadrowania w dokumencie.
5. Tabela (`table-dialog`): liczba wierszy i kolumn, dodawanie/usuwanie wierszy i kolumn, scalanie/podział komórek i usunięcie tabeli.
6. Kontener (`container-dialog`): tytuł, stopka, szerokość, minimalna wysokość, kolor/wyłączenie tła, możliwość zwężania kodu poniżej szerokości treści.

Poza nimi: systemowe otwieranie/zapis pliku i wybór dowolnego koloru RGB; komunikaty o metadanych pliku (obecnie informacyjne), About, braku modułu/dokumentu oraz błędach otwierania, odczytu, zapisu, uruchomienia modułu lub edytora. Import obrazu wywołuje systemowy wybór pliku; kadrowanie odbywa się w dokumencie. Rozwijane menu czcionek, interlinii, szerokości, kolorów, języka kodu oraz menu PPM nie są modalnymi oknami ustawień. Konto i Ustawienia w powłoce są obecnie makietami, nie formularzami.

## Nowy podział

- Natywna `NotebookRibbon`: karty Układ, Wstawianie, Odwołania, Obiekty są w jednym pasku z File/Edit/View/Help; narzędzia znajdują się bezpośrednio poniżej. Kliknięcie aktywnej karty zwija/rozwija narzędzia, kliknięcie innej wybiera ją i rozwija. Nie ma osobnego przycisku zwijania. Zwijanie ukrywa również obszar błędów, zostawiając sam wspólny pasek, i zamyka otwarte menu. Duże przyciski mają jednolite ikony wektorowe i podpisy, małe polecenia układ dwu-/trzyrzędowy, a zakładka aktywna jest podkreślona. Polecenia wykonuje silnik Tiptap, nie kopia dokumentu w WPF.
- Rozbudowane wspólne menu: Marginesy (presety z podglądem i podmenu osobnych krawędzi), Orientacja, Rozmiar (formaty z wymiarami), Obszar (tryb/strony, presety i własna szerokość), Kolor strony (próbki), Obrazy, Równanie i Wyrównaj. Bieżące ustawienia mają zaznaczenia. Tabela zawiera interaktywną siatkę 10 × 8 z podświetlaniem wybieranego rozmiaru i dostępem do dalszych operacji.
- Układ: bezpośrednie pola rozmiaru/orientacji/podziału stron, szerokości, marginesów, lokalnych wcięć i odstępów, koloru i dzielenia wyrazów. Zaawansowany formularz pozostaje pod jawnym przyciskiem „Zaawansowany układ…”, w tym zmiana domyślnych ustawień akapitów.
- Panel prawy: Komentarze, Numeracje, Ustawienia kontenera, Fragmenty robocze, Link, Obraz, Tabela. Numeracje obsługuje stopkę i numerację stron. Istniejące formularze używają dotychczasowych walidatorów i zapisów bez modalnej zasłony.
- Panel górny: AI, Math. Math działa z podglądem, wstawianiem/edycją i automatyczną numeracją wzorów.
- AI, Komentarze i Fragmenty robocze mają przygotowane miejsca oraz jawny komunikat o braku implementacji. Nie tworzą pozornych danych ani nie udają podłączonej usługi.
- Systemowe operacje na plikach, pełny wybór RGB, zaawansowany układ i istotne komunikaty pozostają floating/modalne.

## Inwarianty

- Karta Układ: pierwsza grupa zawiera Obszar, Rozmiar i Kolor. Obszar ma wyłącznie Obszar ciągły oraz Podział na strony; orientacja pionowa/pozioma jest w menu Rozmiar. Szerokość obszaru pozostaje dostępna w zaawansowanym układzie i na pasku formatowania.
- Marginesy, wcięcia i odstępy są jedną grupą wstążki. Pola wcięć mają strzałki co 0,5 mm, a odstępów co 1 pkt, również pod klawiszami ↑/↓. Można wpisywać własne wartości, z przecinkiem lub kropką; granice to 0–100 mm i 0–1000 pkt. Strzałki nie przejmują fokusu od zaznaczenia dokumentu.
- Nazwy grup mają zwarty pasek wysokości 12 px, a małe narzędzia Tekst wspólną lewą oś ikon. Puste pole błędu nie zajmuje dodatkowego wiersza.
- Nowy obszar dokumentu domyślnie ma białe tło. Kolory jawnie zapisane w istniejących notatkach pozostają bez zmian, także po przełączeniu trybu obszaru.

- Kolejność wspólnego paska: File, Edit, View, Układ, Wstawianie, Odwołania, Obiekty, Help. Napisy menu i kart są wyrównane pionowo; podkreślenie aktywnej karty nie przesuwa tekstu ani nie zwiększa wysokości paska.
- Panele zmniejszają obszar dokumentu, nie zasłaniają go. Prawy i górny mogą być otwarte jednocześnie; mają własne zamknięcie i respektują ograniczenie animacji systemowych.
- Przełączenie sekcji anuluje niezapisany szkic poprzedniej sekcji; przełączenie notatki zamyka oba panele. ESC zamyka ostatnio aktywny panel. Nie zapisuje formularzy.
- Link, Math i tabela zachowują pierwotne zaznaczenie. Zmiana treści dokumentu anuluje otwarte szkice właściwości, aby nie zastosować ich do przesuniętego/usuniętego obiektu. Numeracje operuje na aktualnych ustawieniach tej samej notatki.
- Pola akapitowe wstążki zmieniają tylko jedno wskazane ustawienie zaznaczonych/bieżących akapitów, także dla wielozaznaczeń. Inne ustawienia i inne akapity pozostają bez zmian.
- Zmiany zapisuje historia dokumentu. Otwarcie/zamknięcie panelu nie modyfikuje notatki. Błędy pól wstążki są pokazywane w niej, nie w dodatkowym MessageBox.

Testy: `workspace-test.mjs` sprawdza panele, zakres ustawień, cel wstawiania, cofanie, ESC, przełączenie notatki i unieważnienie szkicu; testy WPF sprawdzają kompozycję i zachowanie gestów.

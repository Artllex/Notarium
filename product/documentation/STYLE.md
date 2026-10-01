# Styl Notarium i rola DEV

DEV jest miejscem oceny wspólnych komponentów aplikacji, nie osobnym motywem.
Zmiana wspólnego stylu musi obowiązywać również w modułach produkcyjnych.
Kolory tekstu interfejsu: zwykłe etykiety, menu i opisy białe (#F1F1F1),
główne nagłówki i wyróżnienia błękitne (#3B82D0), napisy pomocnicze szare.
Białe są nazwa Notarium, Konto/Ustawienia, etykieta MODUŁY, nagłówki menu
File/Edit/View/Help oraz tytuły kart. Błękitne pozostają X karty, plus nowej
karty, kosz i narzędzia kontenerów: X, typ, settings i przyciski dodawania.
Treść dokumentów bez zmian.
W Windows nagłówki używają wspólnego stylu SectionHeading; w galerii Web
odpowiadają mu h1/h2 w ui-surface. Treść dokumentów nie dziedziczy tego stylu.

## Wspólna rama aplikacji

`Shared/UI/ApplicationFrame.cs` definiuje pasek tytułu, kontrolki okna, miejsce menu,
panel boczny o początkowej szerokości 250 px (regulowany uchwytem 110–450 px), separator i obszar roboczy. Korzystają z niego ekran główny,
DEV i Notatnik. Rama nie ładuje modułów ani danych: otrzymuje zawartość obszarów.
DEV wypełnia obszar roboczy kartami „Elementy Windows” i „Elementy Web”, bez
uruchamiania Notatnika. Panel boczny służy do przełączania galerii.
Duża ikona Notarium w panelu go ukrywa. W Notatniku po zwinięciu panelu taka sama ikona (28 px) pojawia się w lewym górnym rogu obszaru edycji i przywraca panel; przycisk na pasku tytułu jest wtedy ukryty. W pozostałych oknach panel przywraca ikona paska tytułu.
Przeciągnięcie separatora do minimalnej szerokości ukrywa panel po puszczeniu uchwytu;
ponowne otwarcie przywraca szerokość sprzed tego przeciągnięcia.
Nagłówki i etykiety w zwężonym panelu używają wielokropka przy tej samej czcionce.
Karty DEV korzystają ze wspólnego szablonu TabControl/TabItem; karty dokumentów
Notatnika zachowują edycję tytułów, zamykanie i paginację, ale używają tych samych
zasobów `WorkspaceTabShape` oraz `WorkspaceTabActive`. Zmiana sylwetki lub koloru
karty w motywie obowiązuje w obu miejscach.

Nowy moduł powinien wypełniać wspólną ramę własną zawartością, nie kopiować
paska tytułu, menu ani szablonu galerii DEV.

- `product/source/Shared/UI/ui-policy.json`: wspólna paleta, czcionka i geometria dropdownów dla Windows oraz Web.
- `Shared/UI/Theme.xaml`: szablony Windows, w tym przyciski i zakładki DEV.
- `Shared/Web/UI/theme.js` i `components.css`: adapter tych samych parametrów w Web.
- `Shared/UI/FontPicker.cs`: rzeczywisty wybór czcionki używany przez Notatnik oraz DEV.
- CSS galerii DEV określa wyłącznie układ prezentacji, nie osobny wygląd komponentów.

Weryfikuj oba widoki DEV oraz kontrolkę w module produkcyjnym. Testy kontrastowego tła i parametrów menu zapobiegają powrotowi białego panelu i oddzielnego stylu dropdownu. Dialogi systemowe pozostają kontrolowane przez Windows. DEV nie jest jeszcze interaktywnym edytorem motywu; zmiany zatwierdzane w DEV wprowadzamy do wspólnych źródeł i przebudowujemy aplikację.

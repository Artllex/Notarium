# Styl Notarium i rola DEV

DEV jest miejscem oceny wspólnych komponentów aplikacji, nie osobnym motywem.
Zmiana wspólnego stylu musi obowiązywać również w modułach produkcyjnych.
Kolory tekstu interfejsu: zwykłe etykiety, menu i opisy białe (#F1F1F1),
główne nagłówki i wyróżnienia błękitne (#3B82D0), napisy pomocnicze szare.
W Windows nagłówki używają wspólnego stylu SectionHeading; w galerii Web
odpowiadają mu h1/h2 w ui-surface. Treść dokumentów nie dziedziczy tego stylu.

## Wspólna rama aplikacji

`Shared/UI/ApplicationFrame.cs` definiuje pasek tytułu, kontrolki okna, miejsce menu,
panel boczny 250 px, separator i obszar roboczy. Korzystają z niego ekran główny,
DEV i Notatnik. Rama nie ładuje modułów ani danych: otrzymuje zawartość obszarów.
DEV wypełnia obszar roboczy kartami „Elementy Windows” i „Elementy Web”, bez
uruchamiania Notatnika. Panel boczny służy do przełączania galerii.
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

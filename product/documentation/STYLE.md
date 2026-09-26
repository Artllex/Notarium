# Styl Notarium i rola DEV

DEV jest miejscem oceny wspólnych komponentów aplikacji, nie osobnym motywem.
Zmiana wspólnego stylu musi obowiązywać również w modułach produkcyjnych.

- `product/source/Shared/UI/ui-policy.json`: wspólna paleta, czcionka i geometria dropdownów dla Windows oraz Web.
- `Shared/UI/Theme.xaml`: szablony Windows, w tym przyciski i zakładki DEV.
- `Shared/Web/UI/theme.js` i `components.css`: adapter tych samych parametrów w Web.
- `Shared/UI/FontPicker.cs`: rzeczywisty wybór czcionki używany przez Notatnik oraz DEV.
- CSS galerii DEV określa wyłącznie układ prezentacji, nie osobny wygląd komponentów.

Weryfikuj oba widoki DEV oraz kontrolkę w module produkcyjnym. Testy kontrastowego tła i parametrów menu zapobiegają powrotowi białego panelu i oddzielnego stylu dropdownu. Dialogi systemowe pozostają kontrolowane przez Windows. DEV nie jest jeszcze interaktywnym edytorem motywu; zmiany zatwierdzane w DEV wprowadzamy do wspólnych źródeł i przebudowujemy aplikację.

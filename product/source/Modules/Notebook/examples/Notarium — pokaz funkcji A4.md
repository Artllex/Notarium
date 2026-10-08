<!-- notarium:page-layout %7B%22paged%22%3Atrue%2C%22width%22%3A0%2C%22size%22%3A%22A4%22%2C%22landscape%22%3Afalse%2C%22color%22%3A%22%23202020%22%2C%22top%22%3A20%2C%22bottom%22%3A20%2C%22left%22%3A20%2C%22right%22%3A20%2C%22indentLeft%22%3A0%2C%22indentRight%22%3A0%2C%22before%22%3A0%2C%22after%22%3A8%2C%22footer%22%3A%22Notarium%20%C2%B7%20pokaz%20funkcji%22%2C%22footerDistance%22%3A10%2C%22numbering%22%3Atrue%2C%22start%22%3A1%2C%22hyphenation%22%3Afalse%7D -->

<h1 data-boxwidth="618">Notarium — przykłady funkcji na A4</h1>

<p data-boxwidth="618">Ten edytowalny dokument pokazuje różne rodzaje treści. Włączony jest format A4, marginesy 20 mm, stopka i automatyczna numeracja. Strony powstają przez przepływ treści; w obecnej aplikacji są ułożone obok siebie.</p>

<h2 data-boxwidth="618">1. Formatowanie tekstu</h2>

<section data-boxwidth="618" data-text-flow="true" data-block-group="true" class="text-flow-content"><p>Zwykły tekst, <strong>pogrubienie</strong>, <em>kursywa</em>, <u>podkreślenie</u>, <s>przekreślenie</s> i <code>kod w tekście</code>.</p><p><span style="color: rgb(130, 184, 248);">Ten fragment ma niebieski kolor.</span> <span style="color: rgb(32, 32, 32);"><mark data-color="#ffe08a" style="background-color: rgb(255, 224, 138); color: inherit;">Ten fragment jest wyróżniony zakreślaczem.</mark></span></p><p><span style="font-family: Georgia;">Fragment zapisany czcionką Georgia.</span> Pozostała część zachowuje podstawowy krój.</p><p>Przykładowy odnośnik: <a target="_blank" rel="noopener noreferrer nofollow" href="https://tiptap.dev/docs/editor/core-concepts/schema">dokumentacja modelu dokumentu</a>.</p></section>

<h2 data-boxwidth="618">2. Lokalne ustawienia akapitów</h2>

<section data-boxwidth="618" data-text-flow="true" data-block-group="true" class="text-flow-content"><p data-paragraph-indentleft="8" data-paragraph-indentright="5" data-paragraph-before="6" data-paragraph-after="12" style="padding-left: 30.2362px; padding-right: 18.8976px; margin-top: 8px; margin-bottom: 16px; line-height: 1.5;">Ten akapit ma lokalne wcięcie z lewej (8 mm) i prawej (5 mm), odstęp przed (6 pt), po (12 pt) i interlinię 1,5. Nie zmienia to kolejnego akapitu.</p><p>Ten akapit zachowuje domyślne ustawienia dokumentu. Zaznacz poprzedni akapit i zmień pola na karcie Układ, aby porównać zakres działania.</p><p data-firstlineindent="12.7" style="text-indent: 48px;">Tutaj przesunięta jest tylko pierwsza linia. Tab i Shift+Tab pozwalają zwiększać oraz cofać wcięcie zgodnie z kontekstem zaznaczenia.</p><p style="text-align: center;">Tekst wyrównany do środka.</p><p style="text-align: right;">Tekst wyrównany do prawej.</p></section>

<h2 data-boxwidth="618">3. Listy wewnątrz jednego kontenera</h2>

<section data-boxwidth="618" data-boxtitle="Listy i zadania" data-boxcaption="Listy są częścią treści tego kontenera." data-text-flow="true" data-block-group="true" class="text-flow-content"><p>Lista numerowana z zagnieżdżeniem:</p><ol><li><p>Zebrać pomysły.</p><ol type="a" style="list-style-type: lower-alpha;"><li><p>Określić cel.</p></li><li><p>Zapisać pytania.</p></li></ol></li><li><p>Uporządkować materiał.</p></li><li><p>Przygotować wersję roboczą.</p></li></ol><p>Lista punktowana:</p><ul><li><p>Tekst oraz notatki.</p></li><li><p>Obrazy i tabele.</p><ul><li><p>Podpis pod ilustracją.</p></li><li><p>Opis danych.</p></li></ul></li></ul><p>Lista zadań:</p><ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Przejrzeć przykłady.</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Zmienić treść dokumentu.</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Zapisać własną wersję.</p></div></li></ul></section>

<h2 data-boxwidth="618">4. Kontenery w jednym wierszu</h2>

<section data-layout-row="true" class="layout-row"><section data-boxbackground="#22334a" data-boxtitle="Pomysł" data-boxcaption="Lewy kontener" data-text-flow="true" data-block-group="true" class="text-flow-content"><p><strong>Co chcę opisać?</strong></p><p>Krótki opis problemu i cel dokumentu.</p></section><section data-boxbackground="#263c32" data-boxtitle="Plan" data-boxcaption="Prawy kontener" data-text-flow="true" data-block-group="true" class="text-flow-content"><p><strong>Jak to uporządkować?</strong></p><p>Rozdziały, przykłady i lista kolejnych kroków.</p></section></section>

<h2 data-boxwidth="618">5. Tabela porównawcza</h2>

<table data-boxwidth="618" style="min-width: 75px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>Element</p></th><th colspan="1" rowspan="1"><p>Zastosowanie</p></th><th colspan="1" rowspan="1"><p>Przykład</p></th></tr><tr><td colspan="1" rowspan="1"><p>Akapit</p></td><td colspan="1" rowspan="1"><p>Opis i argumentacja</p></td><td colspan="1" rowspan="1"><p>Wprowadzenie</p></td></tr><tr><td colspan="1" rowspan="1"><p>Lista</p></td><td colspan="1" rowspan="1"><p>Uporządkowane kroki</p></td><td colspan="1" rowspan="1"><p>Plan działania</p></td></tr><tr><td colspan="1" rowspan="1"><p>Tabela</p></td><td colspan="1" rowspan="1"><p>Porównanie wartości</p></td><td colspan="1" rowspan="1"><p>To zestawienie</p></td></tr></tbody></table>

<p data-boxwidth="618">Możesz dodawać wiersze i kolumny, scalać komórki i zmieniać ich szerokość. Siatka w menu Tabela służy do wstawiania nowej tabeli.</p>

<h2 data-boxwidth="618">6. Obraz z tytułem i podpisem</h2>

<figure data-note-image="true" data-placement="block-center"><div class="image-title">Od pomysłu do dokumentu</div><div class="image-viewport" style=""><img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22180%22%20viewBox%3D%220%200%20600%20180%22%3E%3Crect%20width%3D%22600%22%20height%3D%22180%22%20rx%3D%2212%22%20fill%3D%22%23172839%22%2F%3E%3Cg%20fill%3D%22%23234665%22%20stroke%3D%22%2364b5f6%22%20stroke-width%3D%222%22%3E%3Crect%20x%3D%2225%22%20y%3D%2250%22%20width%3D%22150%22%20height%3D%2270%22%20rx%3D%228%22%2F%3E%3Crect%20x%3D%22225%22%20y%3D%2250%22%20width%3D%22150%22%20height%3D%2270%22%20rx%3D%228%22%2F%3E%3Crect%20x%3D%22425%22%20y%3D%2250%22%20width%3D%22150%22%20height%3D%2270%22%20rx%3D%228%22%2F%3E%3C%2Fg%3E%3Cg%20stroke%3D%22%2364b5f6%22%20stroke-width%3D%223%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M180%2085h38m-10-8%2010%208-10%208M380%2085h38m-10-8%2010%208-10%208%22%2F%3E%3C%2Fg%3E%3Cg%20fill%3D%22%23f3f7ff%22%20font-family%3D%22Segoe%20UI%2Csans-serif%22%20font-size%3D%2219%22%20text-anchor%3D%22middle%22%3E%3Ctext%20x%3D%22100%22%20y%3D%2292%22%3EPomys%C5%82%3C%2Ftext%3E%3Ctext%20x%3D%22300%22%20y%3D%2292%22%3ENotatka%3C%2Ftext%3E%3Ctext%20x%3D%22500%22%20y%3D%2292%22%3EDokument%20A4%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E" alt="Schemat: pomysł, notatka i dokument A4" title="Od pomysłu do dokumentu" width="560" style=""></div><figcaption>Rys. 1. Prosty schemat procesu. Ilustracja jest osadzona w pliku i nie wymaga internetu.</figcaption></figure>

<p data-boxwidth="618">Właściwości obrazu pozwalają zmienić jego szerokość, tytuł i podpis oraz rozpocząć kadrowanie.</p>

<h2 data-boxwidth="618">7. Wzory matematyczne</h2>

<p data-boxwidth="618">Wzór w zdaniu: <span data-latex="E = P \cdot t" data-type="inline-math">E = P \cdot t</span>. Dla <span data-latex="P = 100\,\mathrm{W}" data-type="inline-math">P = 100\,\mathrm{W}</span> i <span data-latex="t = 2\,\mathrm{h}" data-type="inline-math">t = 2\,\mathrm{h}</span> otrzymujemy <span data-latex="E = 200\,\mathrm{Wh}" data-type="inline-math">E = 200\,\mathrm{Wh}</span>.</p>

<div data-boxwidth="618" data-latex="\bar{x}=\frac{1}{n}\sum_{i=1}^{n}x_i" data-numbered="true" data-type="block-math">\bar{x}=\frac{1}{n}\sum_{i=1}^{n}x_i</div>

<p data-boxwidth="618">Wzór blokowy ma automatyczny numer. Otwórz panel Math, aby edytować jego źródło LaTeX i zobaczyć podgląd przed zapisaniem.</p>

<h2 data-boxwidth="618">8. Kod i komórka Python</h2>

<pre data-boxwidth="618" language="javascript" data-code-block="true"><code class="language-javascript">const zadania = ["pomysł", "plan", "redakcja"];
const gotowe = zadania.map((nazwa, i) =&gt; `${i + 1}. ${nazwa}`);
console.log(gotowe.join("\n"));</code></pre>

<!-- cell:python -->
```python
wartosci = [12, 18, 24]
srednia = sum(wartosci) / len(wartosci)
print(f"Średnia: {srednia:.1f}")
```

<p data-boxwidth="618">Bloki kodu używają edytora z kolorowaniem składni. Komórka Python jest edytowalna; wykonywanie kodu nie jest jeszcze dostępne.</p>

<h2 data-boxwidth="618">9. Gesty i historia edycji</h2>

<section data-boxwidth="618" data-text-flow="true" data-block-group="true" class="text-flow-content"><p>Na tym tekście możesz sprawdzić zaznaczanie: Ctrl+klik wybiera słowo; dwuklik wybiera linię; trzykrotne kliknięcie wybiera całą treść kontenera. Ctrl+dwuklik pozwala wybierać kilka osobnych linii.</p><p>Skopiowanie kilku elementów listy zachowuje znaczniki; skopiowanie jednego elementu pomija jego numer lub punkt. Kliknięcie poza kontenerem anuluje zaznaczenie kontenera.</p><p>Po dowolnej zmianie sprawdź Cofnij i Ponów. W tym dokumencie celowo pozostawiono zwykły tekst, listy i obiekty, aby można było porównać zachowanie zaznaczeń.</p></section>

<h2 data-boxwidth="618">10. Czego ten przykład nie udaje</h2>

<p data-boxwidth="618">AI, Komentarze i Fragmenty robocze mają miejsce w interfejsie, lecz nie są jeszcze gotowymi usługami. Dokument nie zawiera fikcyjnych komentarzy ani wyników wygenerowanych przez nieistniejącą integrację.</p>

<p data-boxwidth="618">Zmiana marginesów, koloru strony i stopki jest globalna dla dokumentu; wcięcia, odstępy i interlinia mogą być lokalne dla wybranych akapitów.</p>

<section data-block-group="true" data-text-flow="true" data-boxwidth="610">
<h2>11. Ćwiczenie redakcyjne</h2>
<p>Potraktuj ten dokument jako bezpieczne miejsce do sprawdzania edytora. Zacznij od wybrania dwóch sąsiednich akapitów i ustawienia ich interlinii. Porównaj wynik z fragmentem, którego nie zaznaczono. Następnie cofnij operację, aby sprawdzić, czy historia przywraca poprzedni układ. W kolejnym kroku zmień kolor wybranego słowa, dodaj pogrubienie i ponownie użyj Cofnij oraz Ponów. Pozostałe fragmenty powinny zachować swój wygląd.</p>
<p>W części z listami wybierz jeden element i skopiuj go do zwykłego pola tekstowego. Potem skopiuj dwa elementy razem. Porównaj obecność numerów i myślników. Wstaw nową linię na końcu listy i sprawdź kontynuację numeracji. Tab pozwoli zagnieździć element, a Shift+Tab powinien odwrócić zmianę. Zwróć uwagę, że lista wraz ze zdaniem wprowadzającym nadal należy do jednego kontenera tekstowego.</p>
<p>W tabeli wybierz komórkę i otwórz jej narzędzia. Dodaj wiersz, wpisz własny opis, a następnie cofnij obie zmiany. Przy obrazie zmień podpis i szerokość, porównując ilustrację z szerokością strony. W panelu Math zmień wartość we wzorze, obejrzyj podgląd i zatwierdź edycję. W bloku kodu zmodyfikuj nazwę zmiennej. Ten przykład służy do edycji kodu, nie do jego wykonywania.</p>
<p>Na zakończenie zmień tekst stopki, ale nie wpisuj numerów stron ręcznie. Przewiń dokument poziomo, aby obejrzeć kolejne strony A4. Sprawdź, czy stopka pozostaje poza obszarem głównej treści i czy numeracja jest ciągła. Zapisz dokument pod nową nazwą i otwórz zapisaną wersję. Porównaj listy, podpis ilustracji, wzory, tabelę oraz dwa kontenery ustawione obok siebie. Jeśli chcesz zachować oryginalne przykłady, pracuj na własnej kopii pliku.</p>
</section>


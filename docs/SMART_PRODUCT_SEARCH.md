# Smart Product Finder & Vernacular Search

**Project:** Sagar Traders  
**Scope:** Customer Catalogue Search & Multi-Attribute Filtering  
**Components:** `src/features/products/smart-search.ts`, `src/features/products/synonyms.ts`, `src/features/products/query.ts`

---

## 1. Overview & Business Rationale

Construction contractors, masons, and individual home builders frequently search for building materials using vernacular Hindi/Hinglish trade terms, colloquial abbreviations, or localized terminology (e.g. searching for _sariya_, _dhalai cement_, _ret_, _badarpur_, _chuna_, _taar_).

The Smart Product Finder normalizes customer search queries and matches products across multiple fields including vernacular trade synonyms, category names, brand names, SKUs, and specifications.

---

## 2. Vernacular Synonyms Dictionary

Located in `src/features/products/synonyms.ts`:

- **Cement:** _cement_, _simant_, _dhalai_, _plaster_, _opc_, _ppc_, _psc_, _grade 43_, _grade 53_, _bhori_
- **TMT Steel:** _tmt_, _sariya_, _rebar_, _daria_, _fe500_, _fe550_, _rod_, _chhad_, _loha_, _binding wire_, _taar_
- **Aggregates & Sand:** _ret_, _reti_, _baloo_, _badarpur_, _m sand_, _p sand_, _crushed sand_, _rodi_, _gitti_, _gravel_, _stone chips_
- **Bricks & Blocks:** _eent_, _int_, _lal eent_, _red brick_, _fly ash_, _aac block_, _lightweight block_, _concrete block_
- **Plumbing & Pipes:** _pipe_, _nal_, _pvc_, _cpvc_, _upvc_, _fitting_, _water tank_, _tanki_
- **Waterproofing & Admixtures:** _waterproofing_, _cico_, _chemical_, _sealant_, _seelan_, _damping_
- **Structural Steel:** _angle_, _channel_, _beam_, _girder_, _square pipe_, _patta_, _sheet_
- **Building Hardware:** _hardware_, _nail_, _kheel_, _nut_, _bolt_, _hinge_, _kabja_, _wire mesh_, _jaali_

---

## 3. Search Matching Algorithm

1. **Normalization:** Input query is lowercased, trimmed, and stripped of punctuation.
2. **Expansion:** Tokens are matched against the synonym dictionary. Related canonical tokens are appended to the search query.
3. **Multi-Field Weighted Scoring:**
   - Exact SKU match: Highest priority (weight 10).
   - Product name prefix / word match: High priority (weight 8).
   - Category / Brand match: Medium priority (weight 5).
   - Vernacular synonym match: Medium priority (weight 4).
   - Description / Specifications match: Base priority (weight 2).
4. **Faceted Filtering:**
   - Category slug filter.
   - Brand slug filter.
   - Price range (min / max).
   - Unit filter (Bag, Metric Ton, Piece, Cubic Feet, etc.).
   - Stock availability status.

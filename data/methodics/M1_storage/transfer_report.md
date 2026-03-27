# Methodic Transfer Report: M1_2011-07

## Source Information
- **ID**: M1_2011-07
- **Name**: Расчёт выбросов от резервуаров и хранилищ нефтепродуктов
- **Regulatory Basis**: Методика 1 (2011-07)

## Formula Coverage
| Formula Code | Meaning | LHS | RHS |
|--------------|---------|-----|-----|
| 4.2 | Tanks (Oil/Gasoline) | M | 0.163*P38*m*Kt_max*Kr_avg*Kv*Vmax*1e-4 |
| 4.6 | Other Products | M | 0.163 * Kt_min * Vmax * C20 * 1e-3 |
| 6.2 | Equipment Leaks | M_equip | Q_equip*equipCount/3.6 |
| 6.5 | Wastewater | M_wastewater | qsr_summer*wwArea/3600 |
| 6.6 | Sludge | M_sludge | n2*sludgeArea/2592 |

## Validation Results
- **Status**: PASS
- **Script**: `scripts/validate_methodics.py`

## Mapping Notes
- All missing variables (equipCount, wwArea, etc.) have been added to variables.json to ensure full UI visibility and calculation consistency.

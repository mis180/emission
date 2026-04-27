# fuel_stations_2011 - Branch Release Matrix

Audit date: 2026-04-25

Only branches marked `Ready` should be exposed to normal users. `Beta` and `Internal` branches may pass structural/runtime verification, but they still need branch-specific PDF semantic review before production exposure.

| Branch folder | Formula code | Structural | Lookup | Equation | Golden case | PDF recheck | Recommended status | Notes |
|---|---|---|---|---|---|---|---|---|
| `section_4/4_1_turnover_helper` | `4.1.13` | pass | n/a | pass | pass | pending | Internal | Helper branch, not a normal standalone source. |
| `section_4/4_2_oil_gasoline_r38` | `4.2` | pass | pass | pass | pass | pending | Beta | Runtime passes; keep behind branch status until PDF spot-check. |
| `section_4/4_2_pollutant_split` | `4.2_split` | pass | n/a | pass | pass | pending | Internal | Post-processing helper, not a normal source branch. |
| `section_4/4_3_pure_substance` | `4.3` | pass | pass | pass | pass | pending | Beta | Appendix 16 enum/table mismatch fixed; semantic review still pending. |
| `section_4/4_4_known_mixture` | `4.4` | pass | pass | pass | pass | pending | Beta | Runtime passes; keep beta until PDF spot-check. |
| `section_4/4_5_gas_in_water` | `4.5` | pass | pass | pass | pass | pending | Beta | Runtime passes; keep beta until PDF spot-check. |
| `section_4/4_6_other_products_c20` | `4.6` | pass | pass | pass | pass | pending | Beta | Runtime passes; keep beta until PDF spot-check. |
| `section_5/5_2_depot_tanks` | `5.2` | pass | pass | pass | pass | pending | Beta | Product and storage tank selectors repaired; keep beta until Appendix 13/Table 12 PDF review. |
| `section_6/6_1_flanges` | `6.1` | pass | pass | pass | pass | pending | Beta | Product selector restricted to petroleum table coverage. |
| `section_6/6_2_equipment` | `6.2` | pass | pass | pass | pass | pending | Beta | Runtime passes; keep beta until branch-specific PDF review. |
| `section_6/6_3_stationary_seals` | `6.3` | pass | pass | pass | pass | pending | Beta | Runtime passes; keep beta until branch-specific PDF review. |
| `section_6/6_4_relief_valves` | `6.4` | draft | n/a | n/a | n/a | pending | Internal/Blocked | Manifest is draft and build skips it. |
| `section_6/6_4_sample_purge` | `6.4.1` | pass | n/a | pass | pass | pending | Beta | Runtime passes; keep beta until branch-specific PDF review. |
| `section_6/6_5_wastewater` | `6.5` | pass | pass | pass | pass | pending | Beta | Runtime passes; keep beta until branch-specific PDF review. |
| `section_6/6_6_sludge` | `6.6` | pass | pass | pass | pass | pending | Beta | Runtime passes; keep beta until branch-specific PDF review. |
| `section_7/7_1_receive` | `7.1_receive` | pass | pass | pass | pass | pass for ready scope | Ready | Normal-user AZS liquid-fuel receiving branch. |
| `section_7/7_1_refuel` | `7.1_refuel` | pass | pass | pass | pass | pass for ready scope | Ready | Normal-user AZS liquid-fuel vehicle refueling branch. |
| `section_7/7_1_storage` | `7.1_storage` | pass | pass | pass | pass | pass for ready scope | Ready | Normal-user AZS liquid-fuel storage branch; mutually exclusive with combined for same facility. |
| `section_7/7_1_combined` | `7.1_combined` | pass | pass | pass | pass | pass for ready scope | Ready | Primary AZS liquid-fuel branch; includes receive, refuel, and storage losses. |
| `section_7/7_2_gas` | `7.2` | pass | n/a | pass | pass | pending | Beta | Runtime passes, but it is outside the liquid-fuel ready release scope. |

## Normal UI Visibility

`meta.json` now marks only these source types as `ready_public`:

- `azs_tank_receiving`
- `azs_vehicle_refueling`
- `azs_tank_storage`
- `azs_combined`

Other source types are `beta_limited` or `hidden_internal`. `ui/wizard-ui.js` filters branch cards with `beta_limited`, `hidden_internal`, `blocked`, and `not_implemented` visibility from the normal source-type picker.

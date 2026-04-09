import json
import os

mapping = {
  "M10_combustion": "Сжигание топлива в котлах и печах",
  "M11_machining": "Механическая обработка металлов",
  "M12_tanks": "Хранение нефтепродуктов в резервуарах",
  "M1_storage": "Резервуары и хранилища нефтепродуктов",
  "M20_gas_transport": "Транспорт и хранение газа",
  "M21_oil_refining": "Предприятия нефтепереработки и нефтехимии",
  "M22_power_plants": "Тепловые электростанции и котельные",
  "M23_machinery": "Предприятия машиностроения",
  "M24_cement": "Цементное производство",
  "M25_plastics": "Работа с пластмассовыми материалами",
  "M2_welding": "Сварочные работы",
  "M3_unorganized": "Неорганизованные источники",
  "M4_fuel_stations": "Хранение и реализация нефтепродуктов (АЗС)",
  "M5_paint": "Нанесение лакокрасочных материалов",
  "M6_galvanic": "Гальванические покрытия",
  "M7_transport": "Автомобильный транспорт",
  "M8_wastewater": "Очистные сооружения и БОВ",
  "M9_flares": "Факельные установки",
  "M13_objects_cat4": "Объекты IV категории",
  "M14_diesel_installations": "Дизельные установки",
  "M15_ash_slag_waste": "Золошлаковые отходы",
  "M16_landfill_tbo": "Полигоны ТБО",
  "M17_dispersion_concentrations": "Рассеивание выбросов",
  "M18_metallurgy_processes": "Металлургические процессы",
  "M19_nmu_regulation": "Регулирование при НМУ"
}

base_dir = "c:/ANTIGRAVITY"

# Update registry.json
registry_path = os.path.join(base_dir, "data", "registry.json")
with open(registry_path, "r", encoding="utf-8") as f:
    registry = json.load(f)

for methodic in registry.get("methodics", []):
    mid = methodic.get("id")
    if mid in mapping:
        methodic["name"] = mapping[mid]

with open(registry_path, "w", encoding="utf-8") as f:
    json.dump(registry, f, indent=2, ensure_ascii=False)

print("registry.json updated")

# Update meta.json files
methodics_dir = os.path.join(base_dir, "data", "methodics")
for root, dirs, files in os.walk(methodics_dir):
    if "meta.json" in files:
        meta_path = os.path.join(root, "meta.json")
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        
        mid = meta.get("id")
        if mid in mapping:
            meta["name"] = mapping[mid]
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2, ensure_ascii=False)
            print(f"Updated {meta_path}")

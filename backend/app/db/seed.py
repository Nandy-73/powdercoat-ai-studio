"""Seed the database with industrial reference data and demo content."""

import json

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.core.security import hash_password
from app.models import (
    Formulation,
    FormulationItem,
    FormulationVersion,
    Machine,
    MarketInsight,
    Material,
    MaterialPrice,
    ProductionBatch,
    QCRecord,
    RalColor,
    Supplier,
    SupplierProduct,
    Trial,
    User,
)
from app.models.batch import BatchStatus
from app.models.formulation import ChemistrySystem, FormulationStatus
from app.models.material import MaterialCategory
from app.models.user import UserRole

logger = get_logger("seed")


def seed(db: Session) -> None:
    if db.query(User).first():
        logger.info("Database already seeded — skipping")
        return
    logger.info("Seeding database...")
    _users(db)
    materials = _materials(db)
    _suppliers(db)
    _prices(db)
    _machines(db)
    _market(db)
    _ral(db)
    _formulations(db, materials)
    db.commit()
    logger.info("Seed complete")


def _users(db: Session) -> None:
    users = [
        ("admin@powdercoat.ai", "Alexandra Chen", "admin123", UserRole.ADMIN),
        ("rd.manager@powdercoat.ai", "Dr. Rajesh Kumar", "manager123", UserRole.SENIOR_RD_MANAGER),
        ("rd.engineer@powdercoat.ai", "Maria Santos", "engineer123", UserRole.RD_ENGINEER),
        ("color@powdercoat.ai", "Kenji Tanaka", "color123", UserRole.COLOR_ENGINEER),
        ("production@powdercoat.ai", "Hans Mueller", "production123", UserRole.PRODUCTION_MANAGER),
        ("qc@powdercoat.ai", "Fatima Al-Rashid", "qc123", UserRole.QC_ENGINEER),
        ("procurement@powdercoat.ai", "Liu Wei", "procure123", UserRole.PROCUREMENT_MANAGER),
        ("viewer@powdercoat.ai", "Guest Viewer", "viewer123", UserRole.VIEWER),
    ]
    for email, name, pw, role in users:
        db.add(User(email=email, full_name=name, hashed_password=hash_password(pw), role=role))
    db.flush()


def _materials(db: Session) -> dict[str, Material]:
    C = MaterialCategory
    rows = [
        # code, name, category, family, density, cost, supplier, country, function
        ("RES-PE-01", "Carboxyl Polyester Resin (AV 32)", C.RESIN, "Carboxyl Polyester", 1.23, 2.45, "Allnex", "Germany",
         "Primary binder for TGIC outdoor systems (93:7)"),
        ("RES-PE-02", "Carboxyl Polyester Resin (AV 50, hybrid grade)", C.RESIN, "Carboxyl Polyester", 1.25, 2.30, "Arkema", "France",
         "Binder for 50:50–70:30 hybrid systems"),
        ("RES-PE-03", "Carboxyl Polyester Resin (Primid grade, AV 33)", C.RESIN, "Carboxyl Polyester", 1.23, 2.55, "DSM", "Netherlands",
         "TGIC-free outdoor binder for HAA cure (95:5)"),
        ("RES-EP-01", "Bisphenol-A Epoxy Resin (EEW 750)", C.RESIN, "Epoxy Resin", 1.19, 2.85, "KUKDO", "South Korea",
         "Binder for pure epoxy and hybrid; excellent chemical resistance"),
        ("RES-EP-02", "Bisphenol-A Epoxy Resin (EEW 900)", C.RESIN, "Epoxy Resin", 1.19, 2.75, "Olin", "USA",
         "Functional/fusion-bonded epoxy binder"),
        ("RES-PU-01", "Hydroxyl Polyester Resin (OHV 40)", C.RESIN, "Hydroxyl Polyester", 1.22, 2.95, "Covestro", "Germany",
         "Binder for polyurethane powder (blocked isocyanate cure)"),
        ("RES-AC-01", "GMA Acrylic Resin", C.RESIN, "Glycidyl Methacrylate Acrylic", 1.15, 4.60, "Anderson Development", "USA",
         "Automotive clear-coat acrylic binder (DDDA cure)"),
        ("HRD-01", "TGIC Hardener", C.HARDENER, "Triglycidyl Isocyanurate", 1.42, 6.80, "Huntsman", "Switzerland",
         "Crosslinker for carboxyl polyester (93:7)"),
        ("HRD-02", "HAA Hardener (Primid XL-552)", C.HARDENER, "Hydroxyalkylamide", 1.20, 5.90, "EMS-Griltech", "Switzerland",
         "TGIC-free crosslinker for carboxyl polyester (95:5)"),
        ("HRD-03", "Phenolic Hardener", C.HARDENER, "Phenolic", 1.20, 4.20, "KUKDO", "South Korea",
         "Curing agent for pure epoxy systems"),
        ("HRD-04", "Dicyandiamide (DICY)", C.HARDENER, "Dicyandiamide", 1.40, 3.80, "AlzChem", "Germany",
         "Latent epoxy curing agent"),
        ("HRD-05", "Blocked Isocyanate (IPDI adduct)", C.HARDENER, "Blocked Isocyanate", 1.15, 7.20, "Evonik", "Germany",
         "Crosslinker for PU powders; e-caprolactam blocked"),
        ("HRD-06", "Dodecanedioic Acid (DDDA)", C.HARDENER, "Dibasic Acid", 1.14, 5.10, "Cathay Biotech", "China",
         "Crosslinker for GMA acrylic clears"),
        ("PIG-01", "Titanium Dioxide (TiO2) Rutile", C.PIGMENT, "Inorganic Oxide", 4.20, 3.10, "Chemours", "USA",
         "White opacifying pigment; chloride-process rutile"),
        ("PIG-02", "Carbon Black", C.PIGMENT, "Carbon", 1.80, 2.60, "Orion", "Germany",
         "Jet black tinting pigment; very high strength"),
        ("PIG-03", "Iron Oxide Red", C.PIGMENT, "Inorganic Oxide", 5.00, 1.85, "Lanxess", "Germany",
         "Economical durable red-brown pigment"),
        ("PIG-04", "Iron Oxide Yellow", C.PIGMENT, "Inorganic Oxide", 4.10, 1.95, "Lanxess", "Germany",
         "Durable yellow-ochre pigment; limited heat stability"),
        ("PIG-05", "Phthalocyanine Blue 15:3", C.PIGMENT, "Phthalocyanine", 1.60, 8.40, "Sudarshan", "India",
         "High-strength green-shade blue organic pigment"),
        ("PIG-06", "Phthalocyanine Green 7", C.PIGMENT, "Phthalocyanine", 2.10, 9.20, "Heubach", "Germany",
         "Durable blue-shade green organic pigment"),
        ("PIG-07", "Quinacridone Red 122", C.PIGMENT, "Quinacridone", 1.45, 24.50, "DIC", "Japan",
         "High-performance magenta/red; excellent weathering"),
        ("PIG-08", "Bismuth Vanadate Yellow", C.PIGMENT, "Inorganic Complex", 5.60, 32.00, "Ferro", "USA",
         "Bright lead-free yellow; excellent durability"),
        ("PIG-09", "Ultramarine Blue", C.PIGMENT, "Inorganic Complex", 2.35, 3.40, "Nubiola", "Spain",
         "Red-shade blue; acid-sensitive"),
        ("PIG-10", "Organic Red 254 (DPP)", C.PIGMENT, "Diketopyrrolopyrrole", 1.55, 28.00, "BASF", "Germany",
         "Bright signal red; automotive grade"),
        ("FIL-01", "Barium Sulphate (Blanc Fixe)", C.FILLER, "Barium Sulphate", 4.40, 0.55, "Sachtleben", "Germany",
         "Inert filler; gloss retention, chemical resistance"),
        ("FIL-02", "Calcium Carbonate", C.FILLER, "Calcium Carbonate", 2.70, 0.18, "Omya", "Switzerland",
         "Economical extender; matting contribution at high loads"),
        ("FIL-03", "Wollastonite", C.FILLER, "Calcium Silicate", 2.90, 0.65, "Imerys", "France",
         "Needle-shaped reinforcing filler; corrosion resistance"),
        ("FIL-04", "Talc", C.FILLER, "Magnesium Silicate", 2.75, 0.48, "Imerys", "France",
         "Platy filler; improves sanding and texture"),
        ("FLW-01", "Polyacrylate Flow Agent", C.FLOW_AGENT, "Polyacrylate", 1.05, 4.80, "Estron", "USA",
         "Leveling agent; prevents craters and orange peel (0.8–1.5%)"),
        ("FLW-02", "Flow Agent Masterbatch (65% on silica)", C.FLOW_AGENT, "Polyacrylate", 1.30, 3.90, "BYK", "Germany",
         "Free-flowing powder flow additive"),
        ("BNZ-01", "Benzoin", C.BENZOIN, "Benzoin", 1.31, 5.20, "Miwon", "South Korea",
         "Degassing agent; prevents pinholes (0.3–0.5%)"),
        ("DEG-01", "Micronized Degassing Additive", C.DEGASSING_AGENT, "Amide Wax", 1.00, 6.10, "Clariant", "Switzerland",
         "Degassing for thick films and zinc substrates"),
        ("TEX-01", "PTFE-Modified PE Texture Additive", C.TEXTURE_ADDITIVE, "PTFE/PE Wax", 1.00, 8.90, "Shamrock", "USA",
         "Fine to sand texture generation (0.8–3%)"),
        ("TEX-02", "Rubber Texture Agent", C.TEXTURE_ADDITIVE, "Cross-linked Rubber", 1.15, 6.40, "Deuteron", "Germany",
         "Coarse structure / wrinkle effects"),
        ("SPA-01", "Matting Agent (Cyclic Amidine salt)", C.SPECIAL_ADDITIVE, "Amidine", 1.10, 12.50, "Vestagon", "Germany",
         "Chemical matting for polyester/HAA systems"),
        ("SPA-02", "UV Absorber (Triazine)", C.SPECIAL_ADDITIVE, "Triazine", 1.15, 22.00, "BASF", "Germany",
         "UV protection for super-durable systems"),
        ("SPA-03", "Anti-Static Additive", C.SPECIAL_ADDITIVE, "Quaternary Ammonium", 1.05, 9.80, "Croda", "UK",
         "Improves fluidization and tribo-charging"),
        ("WAX-01", "Carnauba Wax", C.WAX, "Natural Ester Wax", 1.00, 7.60, "Foncepi", "Brazil",
         "Slip and mar resistance"),
        ("WAX-02", "Micronized PE Wax", C.WAX, "Polyethylene Wax", 0.97, 4.30, "Micro Powders", "USA",
         "Scratch resistance and smooth feel"),
    ]
    out: dict[str, Material] = {}
    for code, name, cat, family, density, cost, supplier, country, function in rows:
        m = Material(
            code=code, name=name, category=cat, chemical_family=family,
            density_g_cm3=density, cost_per_kg=cost, supplier_name=supplier,
            country=country, function=function,
            safety_info="Refer to SDS. Use dust extraction; powder is a combustible dust (ATEX zone 22)."
            + (" TGIC is a Category 2 mutagen — avoid inhalation, use closed handling." if "TGIC" in name else ""),
            tds_url=f"https://docs.powdercoat.ai/tds/{code}.pdf",
            sds_url=f"https://docs.powdercoat.ai/sds/{code}.pdf",
            specs=json.dumps({"appearance": "powder/granule", "storage": "max 25°C, dry"}),
        )
        db.add(m)
        out[code] = m
    db.flush()
    return out


def _suppliers(db: Session) -> None:
    rows = [
        ("Allnex", "Germany", "https://allnex.com", "ISO 9001, ISO 14001", 4.7, 21,
         [("Crylcoat Polyester Resins", "resin", 2.45), ("Additol Flow Agents", "flow_agent", 4.9)]),
        ("KUKDO Chemical", "South Korea", "https://kukdo.com", "ISO 9001", 4.5, 28,
         [("Epoxy Resin EEW 750", "resin", 2.70), ("Phenolic Hardener", "hardener", 4.05)]),
        ("Huntsman", "Switzerland", "https://huntsman.com", "ISO 9001, RC14001", 4.6, 25,
         [("Araldite TGIC", "hardener", 6.60)]),
        ("Chemours", "USA", "https://chemours.com", "ISO 9001", 4.8, 35,
         [("Ti-Pure R-902+ TiO2", "pigment", 3.05)]),
        ("Lomon Billions", "China", "https://lomonbillions.com", "ISO 9001", 4.2, 40,
         [("BLR-699 TiO2", "pigment", 2.35)]),
        ("Lanxess", "Germany", "https://lanxess.com", "ISO 9001, ISO 50001", 4.6, 21,
         [("Bayferrox Iron Oxides", "pigment", 1.80)]),
        ("Sudarshan Chemical", "India", "https://sudarshan.com", "ISO 9001, GreenCo", 4.3, 30,
         [("Sudaperm Phthalo Blue", "pigment", 7.90)]),
        ("EMS-Griltech", "Switzerland", "https://ems-griltech.com", "ISO 9001", 4.7, 24,
         [("Primid XL-552", "hardener", 5.75)]),
        ("Evonik", "Germany", "https://evonik.com", "ISO 9001, ISO 14001", 4.7, 21,
         [("Vestagon B 1530 Blocked Isocyanate", "hardener", 7.05)]),
        ("Omya", "Switzerland", "https://omya.com", "ISO 9001", 4.4, 14,
         [("Omyacarb Calcium Carbonate", "filler", 0.16)]),
        ("BYK (ALTANA)", "Germany", "https://byk.com", "ISO 9001", 4.8, 18,
         [("BYK-360P Flow Additive", "flow_agent", 4.10)]),
        ("Shamrock Technologies", "USA", "https://shamrocktechnologies.com", "ISO 9001", 4.4, 30,
         [("Texture 5380 PTFE Additive", "texture_additive", 8.60)]),
        ("Ningbo Color Masters", "China", "https://ningbocolor.example.com", "ISO 9001", 4.0, 45,
         [("Economy Epoxy Resin", "resin", 2.20), ("Barium Sulphate", "filler", 0.42)]),
        ("Kolor Jet Chemical", "India", "https://kolorjet.example.com", "ISO 9001", 4.1, 35,
         [("Pigment Dispersions", "pigment", 5.10)]),
    ]
    for company, country, site, certs, rating, lead, products in rows:
        s = Supplier(
            company=company, country=country, website=site,
            contact_email=f"sales@{site.split('//')[1]}",
            contact_phone="+00 000 000 000",
            certifications=certs,
            distributor_info="Regional distributors available in EMEA, APAC and Americas.",
            rating=rating, lead_time_days=lead,
        )
        db.add(s)
        db.flush()
        for pname, cat, price in products:
            db.add(
                SupplierProduct(
                    supplier_id=s.id, product_name=pname, category=cat,
                    price_per_kg=price, moq_kg=500 if cat in ("resin", "filler") else 25,
                )
            )
    db.flush()


def _prices(db: Session) -> None:
    benchmarks = {
        ("Carboxyl Polyester Resin", "resin"): [
            ("China", 2.10, 3.9, 40, 4.0), ("India", 2.25, 4.0, 35, 4.1),
            ("Germany", 2.55, 4.8, 14, 4.7), ("USA", 2.65, 4.7, 21, 4.6),
            ("South Korea", 2.35, 4.4, 28, 4.4), ("Turkey", 2.30, 4.1, 25, 4.2),
        ],
        ("Epoxy Resin EEW 750", "resin"): [
            ("China", 2.45, 4.0, 40, 4.1), ("South Korea", 2.70, 4.6, 28, 4.5),
            ("Germany", 3.00, 4.8, 14, 4.7), ("USA", 3.05, 4.7, 21, 4.6),
            ("India", 2.60, 4.1, 35, 4.1),
        ],
        ("TGIC Hardener", "hardener"): [
            ("China", 5.90, 4.2, 42, 4.2), ("Japan", 7.40, 4.9, 30, 4.8),
            ("Switzerland", 7.10, 4.9, 25, 4.7), ("India", 6.20, 4.2, 35, 4.2),
        ],
        ("Titanium Dioxide Rutile", "pigment"): [
            ("China", 2.35, 4.1, 40, 4.1), ("USA", 3.10, 4.9, 30, 4.8),
            ("Germany", 3.05, 4.8, 18, 4.7), ("Australia", 2.90, 4.6, 35, 4.5),
            ("Ukraine", 2.60, 4.2, 50, 3.9), ("India", 2.55, 4.2, 35, 4.2),
        ],
        ("Carbon Black", "pigment"): [
            ("China", 2.20, 4.0, 40, 4.1), ("Germany", 2.85, 4.8, 18, 4.7),
            ("USA", 2.75, 4.7, 25, 4.6), ("India", 2.35, 4.1, 35, 4.2),
        ],
        ("Barium Sulphate", "filler"): [
            ("China", 0.42, 4.2, 40, 4.2), ("Germany", 0.62, 4.8, 14, 4.7),
            ("India", 0.48, 4.2, 35, 4.1), ("Turkey", 0.50, 4.3, 28, 4.2),
        ],
        ("Polyacrylate Flow Agent", "flow_agent"): [
            ("USA", 4.85, 4.8, 25, 4.7), ("Germany", 4.75, 4.8, 18, 4.8),
            ("China", 3.60, 4.0, 40, 4.0), ("Taiwan", 4.10, 4.4, 30, 4.3),
        ],
        ("Benzoin", "benzoin"): [
            ("South Korea", 5.10, 4.6, 28, 4.5), ("China", 4.40, 4.1, 40, 4.1),
            ("India", 4.70, 4.2, 35, 4.2),
        ],
    }
    for (material, category), rows in benchmarks.items():
        for country, price, quality, days, rating in rows:
            db.add(
                MaterialPrice(
                    material_name=material, category=category, country=country,
                    price_per_kg=price, quality_score=quality, delivery_days=days,
                    supplier_rating=rating, import_available=1,
                )
            )
    db.flush()


def _machines(db: Session) -> None:
    rows = [
        ("Container Mixer CM 500", "mixer", "MIXACO", "Germany", "500 L / 150 kg per cycle", 85000, 22, 2,
         {"speed": "up to 1800 rpm", "tooling": "interchangeable"}),
        ("Horizontal Premixer HM 1000", "mixer", "Promixon", "Italy", "1000 L", 62000, 30, 2,
         {"speed": "variable", "discharge": "pneumatic"}),
        ("Twin-Screw Extruder ZSK 26", "extruder", "Coperion", "Germany", "120–200 kg/h", 210000, 45, 2,
         {"screw_diameter": "26 mm", "l_d": "15:1", "zones": 4}),
        ("Twin-Screw Extruder TEM-48", "extruder", "Toshiba Machine", "Japan", "600–900 kg/h", 480000, 110, 2,
         {"screw_diameter": "48 mm", "l_d": "17:1"}),
        ("Buss Kneader MKS 70", "extruder", "Buss", "Switzerland", "400–700 kg/h", 520000, 90, 2,
         {"type": "reciprocating single screw"}),
        ("Chill Roll + Crusher CC-800", "cooling_system", "SJ Machinery", "China", "up to 800 kg/h", 38000, 15, 1,
         {"belt_width": "800 mm", "water_cooled": True}),
        ("Squeeze Cooler SQC-600", "cooling_system", "Neuman & Esser", "Germany", "600 kg/h", 95000, 25, 2,
         {"output": "flakes"}),
        ("Pre-Crusher PC-30", "crusher", "Yantai Lube", "China", "up to 1000 kg/h", 18000, 11, 1,
         {"output_size": "5-10 mm chips"}),
        ("ACM Grinding System ACM-30", "grinding", "Hosokawa Micron", "Japan", "250–350 kg/h", 260000, 55, 2,
         {"classifier": "integrated", "d50": "30-40 µm"}),
        ("ACM Mill PCG-60", "grinding", "Kemutec", "UK", "500–700 kg/h", 310000, 75, 2,
         {"cyclone": "high efficiency", "dust_filter": "integrated"}),
        ("Ultrasonic Sieve US-600", "sieving", "Russell Finex", "UK", "up to 700 kg/h", 42000, 3, 2,
         {"mesh": "120-200 µm", "ultrasonic_deblinding": True}),
        ("Rotary Sieve RS-800", "sieving", "Gericke", "Switzerland", "800 kg/h", 36000, 4, 2,
         {"mesh": "140 µm"}),
        ("Auto Box Filling Line BF-25", "packaging", "Concetti", "Italy", "25 kg boxes, 240/h", 120000, 12, 2,
         {"weigher": "net weigher, ±10 g"}),
        ("Gel Time Tester GT-2", "laboratory", "Coesfeld", "Germany", "125-250°C plate", 8500, 1.2, 1,
         {"standard": "ISO 8130-6"}),
        ("Gloss Meter Trio 20/60/85", "laboratory", "BYK-Gardner", "Germany", "-", 4200, 0, 2,
         {"standard": "ISO 2813"}),
        ("Spectrophotometer Ci7800", "laboratory", "X-Rite", "USA", "d/8 sphere", 28000, 0.3, 2,
         {"geometry": "d/8", "aperture": "6-25 mm"}),
        ("Salt Spray Chamber SF-450", "laboratory", "Ascott", "UK", "450 L", 21000, 2.5, 2,
         {"standard": "ASTM B117 / ISO 9227"}),
        ("Electrostatic Spray Booth Lab", "laboratory", "Gema", "Switzerland", "manual, lab scale", 32000, 6, 2,
         {"gun": "corona 100 kV"}),
    ]
    for name, mtype, mfr, country, capacity, price, kw, warranty, specs in rows:
        db.add(
            Machine(
                name=name, machine_type=mtype, manufacturer=mfr, country=country,
                capacity=capacity, estimated_price_usd=price, energy_kw=kw,
                warranty_years=warranty, specs=json.dumps(specs),
            )
        )
    db.flush()


def _market(db: Session) -> None:
    rows = [
        ("technology", "Low-bake powders reach 150°C commercial maturity",
         "Catalyzed polyester/HAA and hybrid systems curing at 150-160°C are now offered by all major suppliers, "
         "opening MDF and assembled-part markets and cutting oven energy ~20%.", "high", "Global"),
        ("technology", "One-shot super-durable metallics via bonding",
         "Improved bonding processes give consistent metallic effect in recycling streams, reducing rejects on "
         "architectural projects.", "medium", "Global"),
        ("trend", "Powder-on-MDF adoption accelerating",
         "Furniture OEMs in Europe and North America are converting from liquid UV to low-bake powder on MDF.", "medium", "Europe, North America"),
        ("shortage", "TGIC supply tightening in Q3",
         "Planned maintenance at two major Asian TGIC plants is expected to tighten supply; HAA (Primid) grades "
         "are the recommended hedge for outdoor polyesters.", "high", "Asia-Pacific"),
        ("price", "TiO2 prices +6% quarter-over-quarter",
         "Chloride-process rutile is up on ore costs and EU anti-dumping duties on Chinese imports. "
         "Consider dual-sourcing with qualified sulfate-process grades for non-critical whites.", "high", "Europe"),
        ("price", "Epoxy resin softening on new Asian capacity",
         "New EEW 700-900 capacity in China and Korea is pushing spot prices down ~4%.", "medium", "Asia-Pacific"),
        ("alternative", "Bio-based polyester resins commercially available",
         "Resins with 30-50% bio-based monomer content (isosorbide, bio-succinic) now match standard durability; "
         "premium ~8-12%.", "medium", "Global"),
        ("sustainability", "Recyclable powder reclaim programs expanding",
         "Closed-loop reclaim of overspray between coater and manufacturer reduces waste disposal cost and "
         "supports EPD scoring.", "medium", "Global"),
        ("regulation", "EU microplastics rules exempt cured coatings — monitor definitions",
         "ECHA restriction on intentionally-added microplastics excludes reacted/cured films, but raw powder "
         "handling documentation requirements increase.", "medium", "Europe"),
        ("regulation", "TGIC classification pressure continues",
         "Mutagenicity classification keeps TGIC under review in multiple jurisdictions; Japan and Germany markets "
         "are effectively TGIC-free. Plan HAA conversions for export lines.", "high", "Global"),
    ]
    for category, title, summary, impact, region in rows:
        db.add(MarketInsight(category=category, title=title, summary=summary, impact=impact, region=region))
    db.flush()


def _ral(db: Session) -> None:
    rows = [
        ("RAL 1003", "Signal Yellow", "#F9A800"), ("RAL 1013", "Oyster White", "#EAE6CA"),
        ("RAL 1015", "Light Ivory", "#E6D690"), ("RAL 1023", "Traffic Yellow", "#FAD201"),
        ("RAL 2004", "Pure Orange", "#F44611"), ("RAL 3000", "Flame Red", "#AF2B1E"),
        ("RAL 3002", "Carmine Red", "#A2231D"), ("RAL 3020", "Traffic Red", "#CC0605"),
        ("RAL 4005", "Blue Lilac", "#76689A"), ("RAL 5002", "Ultramarine Blue", "#20214F"),
        ("RAL 5005", "Signal Blue", "#1E2460"), ("RAL 5010", "Gentian Blue", "#0E294B"),
        ("RAL 5012", "Light Blue", "#3B83BD"), ("RAL 5015", "Sky Blue", "#2271B3"),
        ("RAL 6002", "Leaf Green", "#2D572C"), ("RAL 6005", "Moss Green", "#2F4538"),
        ("RAL 6018", "Yellow Green", "#57A639"), ("RAL 6029", "Mint Green", "#20603D"),
        ("RAL 7001", "Silver Grey", "#8A9597"), ("RAL 7016", "Anthracite Grey", "#293133"),
        ("RAL 7035", "Light Grey", "#D7D7D7"), ("RAL 7040", "Window Grey", "#9DA1AA"),
        ("RAL 8017", "Chocolate Brown", "#45322E"), ("RAL 9001", "Cream", "#FDF4E3"),
        ("RAL 9003", "Signal White", "#F4F4F4"), ("RAL 9005", "Jet Black", "#0A0A0A"),
        ("RAL 9010", "Pure White", "#FFFFFF"), ("RAL 9016", "Traffic White", "#F6F6F6"),
        ("RAL 9006", "White Aluminium", "#A5A5A5"), ("RAL 9007", "Grey Aluminium", "#8F8F8F"),
    ]
    for code, name, hex_ in rows:
        h = hex_.lstrip("#")
        db.add(
            RalColor(
                code=code, name=name, hex=hex_,
                r=int(h[0:2], 16), g=int(h[2:4], 16), b=int(h[4:6], 16),
            )
        )
    db.flush()


def _formulations(db: Session, mats: dict) -> None:
    admin = db.query(User).first()

    def build(name, code, system, status, items, finish="smooth", gloss=90.0,
              temp=180.0, minutes=10.0, description=""):
        f = Formulation(
            name=name, code=code, system=system, status=status,
            target_finish=finish, target_gloss=gloss, cure_temp_c=temp,
            cure_time_min=minutes, description=description, created_by=admin.id,
        )
        db.add(f)
        db.flush()
        for mat_code, kg in items:
            db.add(FormulationItem(formulation_id=f.id, material_id=mats[mat_code].id, weight_kg=kg))
        db.flush()
        db.refresh(f)
        db.add(
            FormulationVersion(
                formulation_id=f.id, version=1,
                snapshot=json.dumps([{"material_id": mats[c].id, "weight_kg": kg} for c, kg in items]),
                note="Initial version",
            )
        )
        return f

    white = build(
        "RAL 9016 Architectural White", "PC-PE-9016", ChemistrySystem.POLYESTER,
        FormulationStatus.PRODUCTION,
        [("RES-PE-01", 57.0), ("HRD-01", 4.3), ("PIG-01", 25.0), ("FIL-01", 11.5),
         ("FLW-01", 1.2), ("BNZ-01", 0.5), ("WAX-02", 0.5)],
        gloss=88, description="Qualicoat class 1 outdoor white for aluminium profiles.",
    )
    black = build(
        "RAL 9005 Sand Texture Black", "PC-HY-9005T", ChemistrySystem.HYBRID,
        FormulationStatus.APPROVED,
        [("RES-PE-02", 36.0), ("RES-EP-01", 24.0), ("PIG-02", 1.6), ("FIL-02", 34.2),
         ("FLW-01", 1.0), ("BNZ-01", 0.4), ("TEX-01", 2.8)],
        finish="sand_texture", gloss=25,
        description="Economy interior texture black for shelving and fixtures.",
    )
    red = build(
        "RAL 3020 Traffic Red Gloss", "PC-PE-3020", ChemistrySystem.POLYESTER,
        FormulationStatus.TRIAL,
        [("RES-PE-03", 60.0), ("HRD-02", 3.2), ("PIG-10", 6.5), ("PIG-03", 2.0),
         ("PIG-01", 4.0), ("FIL-01", 22.6), ("FLW-01", 1.2), ("BNZ-01", 0.5)],
        gloss=92, description="TGIC-free bright red, machine-tone development.",
    )
    epoxy = build(
        "Functional Epoxy Primer Grey", "PC-EP-7035P", ChemistrySystem.EPOXY,
        FormulationStatus.APPROVED,
        [("RES-EP-02", 52.0), ("HRD-04", 4.0), ("PIG-01", 12.0), ("PIG-02", 0.15),
         ("FIL-03", 29.75), ("FLW-01", 1.3), ("BNZ-01", 0.4), ("DEG-01", 0.4)],
        gloss=70, description="Corrosion-protection primer for rebar and pipe.",
    )
    pu = build(
        "PU Clear Coat Automotive", "PC-PU-CLR1", ChemistrySystem.POLYURETHANE,
        FormulationStatus.DRAFT,
        [("RES-PU-01", 76.0), ("HRD-05", 19.0), ("FLW-01", 1.3), ("BNZ-01", 0.5),
         ("SPA-02", 2.2), ("WAX-01", 1.0)],
        gloss=95, temp=190, minutes=15, description="High-DOI wheel clear, development stage.",
    )

    # Trials
    for f, rows in [
        (white, [("pass", 88.5, "Gloss on target; Qualicoat panel set submitted."),
                 ("pass", 87.9, "Repeat batch confirmation.")]),
        (red, [("fail", 78.0, "Shade too dark vs. RAL 3020 target — increase DPP red, reduce iron oxide."),
               ("pending", None, "Correction trial queued.")]),
        (black, [("pass", 24.0, "Texture uniform at 80-100 µm.")]),
        (epoxy, [("pass", 71.0, "500 h salt spray passed, creep < 1 mm.")]),
    ]:
        for result, gloss, notes in rows:
            db.add(Trial(formulation_id=f.id, result=result, gloss_measured=gloss, notes=notes))

    # Batches + QC
    b1 = ProductionBatch(batch_number="B20260701-0001", formulation_id=white.id,
                         size_kg=2000, scale="production", status=BatchStatus.COMPLETED, cost_total=2000 * 2.62)
    b2 = ProductionBatch(batch_number="B20260703-0002", formulation_id=black.id,
                         size_kg=800, scale="production", status=BatchStatus.IN_PROGRESS, cost_total=800 * 1.55)
    b3 = ProductionBatch(batch_number="B20260705-0003", formulation_id=epoxy.id,
                         size_kg=500, scale="pilot", status=BatchStatus.PLANNED, cost_total=500 * 2.1)
    db.add_all([b1, b2, b3])
    db.flush()
    db.add_all([
        QCRecord(batch_id=b1.id, test_name="Gloss 60°", value=88.2, unit="GU", result="pass"),
        QCRecord(batch_id=b1.id, test_name="Gel time 180°C", value=142, unit="s", result="pass"),
        QCRecord(batch_id=b1.id, test_name="Particle size d50", value=34.8, unit="µm", result="pass"),
        QCRecord(batch_id=b1.id, test_name="Impact resistance", value=160, unit="in·lb", result="pass"),
        QCRecord(batch_id=b2.id, test_name="Gel time 180°C", value=155, unit="s", result="pass"),
        QCRecord(batch_id=b2.id, test_name="Texture uniformity", value=None, unit="", result="pass",
                 notes="Visual panel vs. master OK"),
    ])
    db.flush()

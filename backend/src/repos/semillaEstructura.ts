// Semilla de la estructura organizacional para DATA_MODE=memoria (SF-03).
// GENERADO de 00_Consolidado_2026Q1.xlsx (hojas Catalogs, Risk Library y Risk Register);
// mismos datos que 018_seed_jerarquia.sql y 020_seed_riesgos.sql. No editar a mano.
// Los niveles de riesgo son FICTICIOS: el Consolidado no los trae. Los nombres son INFERIDOS
// (ver 022_seed_nombres_reales.sql); Spin y FEMSA Servicios, sin confirmar. Sin la
// subdivisión B-923765, que no tiene código.

import type { NivelRiesgo } from "../domain/estructura.js";

export interface SemillaUnidad {
  nombre: string;
  nombreReal: string | null;
  departamento: string | null;
  divisiones: Array<{
    nombre: string;
    nombreReal: string | null;
    subdivisiones: Array<{
      nombre: string;
      nombreReal: string | null;
      pais: string | null;
      areas: string[];
      riesgos: Array<{ nombre: string; nivel: NivelRiesgo | null; procedimientoControl: string | null }>;
    }>;
  }>;
}

export const SEMILLA_ESTRUCTURA: SemillaUnidad[] = [
  {
    "nombre": "UDN-0004",
    "nombreReal": "Proximidad y Salud",
    "departamento": "Retail & Spin",
    "divisiones": [
      {
        "nombre": "DIVISION-0009",
        "nombreReal": "Oxxo México",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0007",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Administración y Finanzas",
              "Cadena de Suministro",
              "Expansión e Infraestructura",
              "Operaciones",
              "Recursos Humanos",
              "Sostenibilidad y Energía",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Sobrevaluación Activos Fijos",
                "nivel": "Medio",
                "procedimientoControl": "CP-353106"
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-352448"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Explotación infantil",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351516"
              },
              {
                "nombre": "Procesamiento ineficiente de pagos",
                "nivel": "Bajo",
                "procedimientoControl": "CP-351851"
              },
              {
                "nombre": "Subvaluación Gastos",
                "nivel": "Medio",
                "procedimientoControl": "CP-353137"
              },
              {
                "nombre": "Subvaluación CxP",
                "nivel": "Medio",
                "procedimientoControl": "CP-353112"
              },
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351856"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-407450"
              },
              {
                "nombre": "Incumplimiento Fiscal",
                "nivel": "Alto",
                "procedimientoControl": "CP-352416"
              },
              {
                "nombre": "Sobrevaluación Arrendamientos",
                "nivel": "Medio",
                "procedimientoControl": "CP-353108"
              },
              {
                "nombre": "Sobrevaluación Efectivo",
                "nivel": "Medio",
                "procedimientoControl": "CP-353120"
              },
              {
                "nombre": "Sobrevaluación CxC",
                "nivel": "Medio",
                "procedimientoControl": "CP-353128"
              },
              {
                "nombre": "Subvaluación Arrendamientos",
                "nivel": "Medio",
                "procedimientoControl": "CP-407458"
              },
              {
                "nombre": "Sobrevaluación Intangibles",
                "nivel": "Medio",
                "procedimientoControl": "CP-891409"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0032",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Tecnología de la Información"
            ],
            "riesgos": []
          }
        ]
      },
      {
        "nombre": "DIVISION-0010",
        "nombreReal": "Salud y Multiformatos",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0022",
            "nombreReal": null,
            "pais": "Chile",
            "areas": [
              "Administración y Finanzas",
              "Expansión e Infraestructura",
              "Operaciones",
              "Recursos Humanos",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-352008"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Cambios no autorizados",
                "nivel": "Medio",
                "procedimientoControl": "CP-350636"
              },
              {
                "nombre": "Sobrevaluación Activos Fijos",
                "nivel": "Medio",
                "procedimientoControl": "CP-352690"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-407444"
              },
              {
                "nombre": "Sobrevaluación Efectivo",
                "nivel": "Medio",
                "procedimientoControl": "CP-352705"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0010",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Tecnología de la Información",
              "Administración y Finanzas",
              "Recursos Humanos",
              "Jurídico y Secretarías"
            ],
            "riesgos": [
              {
                "nombre": "Cambios no autorizados",
                "nivel": "Medio",
                "procedimientoControl": "CP-373961"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0009",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Tecnología de la Información",
              "Administración y Finanzas",
              "Cadena de Suministro",
              "Expansión e Infraestructura",
              "Operaciones",
              "Recursos Humanos",
              "Sostenibilidad y Energía"
            ],
            "riesgos": [
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-918707"
              },
              {
                "nombre": "Compromiso por ciberataques",
                "nivel": "Crítico",
                "procedimientoControl": "CP-918708"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-937040"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0018",
            "nombreReal": null,
            "pais": "Colombia",
            "areas": [
              "Administración y Finanzas",
              "Cadena de Suministro",
              "Expansión e Infraestructura",
              "Operaciones",
              "Recursos Humanos",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-352105"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Sobrevaluación Activos Fijos",
                "nivel": "Medio",
                "procedimientoControl": "CP-352831"
              },
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-350707"
              },
              {
                "nombre": "Interrupción o degradación del servicio",
                "nivel": "Medio",
                "procedimientoControl": "CP-488476"
              },
              {
                "nombre": "Sobrevaluación Efectivo",
                "nivel": "Medio",
                "procedimientoControl": "CP-830752"
              },
              {
                "nombre": "Sobrevaluación Intangibles",
                "nivel": "Medio",
                "procedimientoControl": "CP-936766"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0021",
            "nombreReal": null,
            "pais": "Ecuador",
            "areas": [
              "Administración y Finanzas",
              "Cadena de Suministro",
              "Expansión e Infraestructura",
              "Operaciones",
              "Recursos Humanos",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-350714"
              },
              {
                "nombre": "Sobrevaluación Activos Fijos",
                "nivel": "Medio",
                "procedimientoControl": "CP-352876"
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-830743"
              },
              {
                "nombre": "Interrupción o degradación del servicio",
                "nivel": "Medio",
                "procedimientoControl": "CP-918735"
              },
              {
                "nombre": "Sobrevaluación Intangibles",
                "nivel": "Medio",
                "procedimientoControl": "CP-936754"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0023",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Administración y Finanzas",
              "Cadena de Suministro",
              "Expansión e Infraestructura",
              "Operaciones",
              "Recursos Humanos",
              "Sostenibilidad y Energía",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-352602"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Explotación infantil",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351592"
              },
              {
                "nombre": "Subvaluación Gastos",
                "nivel": "Medio",
                "procedimientoControl": "CP-362153"
              },
              {
                "nombre": "Sobrevaluación Activos Fijos",
                "nivel": "Medio",
                "procedimientoControl": "CP-353295"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0035",
            "nombreReal": null,
            "pais": "Chile",
            "areas": [
              "Administración y Finanzas",
              "Recursos Humanos",
              "Sostenibilidad y Energía"
            ],
            "riesgos": [
              {
                "nombre": "Sobrevaluación Activos Fijos",
                "nivel": "Medio",
                "procedimientoControl": "CP-352714"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0026",
            "nombreReal": null,
            "pais": "Chile",
            "areas": [
              "Administración y Finanzas",
              "Recursos Humanos",
              "Sostenibilidad y Energía"
            ],
            "riesgos": [
              {
                "nombre": "Sobrevaluación Activos Fijos",
                "nivel": "Medio",
                "procedimientoControl": "CP-936780"
              }
            ]
          }
        ]
      },
      {
        "nombre": "DIVISION-0001",
        "nombreReal": "Américas y Movilidad",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0034",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Administración y Finanzas",
              "Cadena de Suministro",
              "Expansión e Infraestructura",
              "Operaciones",
              "Recursos Humanos",
              "Sostenibilidad y Energía",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-352366"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Procesamiento ineficiente de pagos",
                "nivel": "Bajo",
                "procedimientoControl": "CP-351812"
              },
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351811"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-407478"
              },
              {
                "nombre": "Incumplimiento en hidrocarburos",
                "nivel": "Alto",
                "procedimientoControl": "CP-407585"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0006",
            "nombreReal": null,
            "pais": "Colombia",
            "areas": [
              "Operaciones",
              "Recursos Humanos",
              "Tecnología de la Información",
              "Administración y Finanzas"
            ],
            "riesgos": [
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-353663"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Procesamiento ineficiente de pagos",
                "nivel": "Bajo",
                "procedimientoControl": "CP-351660"
              },
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-351205"
              },
              {
                "nombre": "Cambios no autorizados",
                "nivel": "Medio",
                "procedimientoControl": "CP-374003"
              },
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351654"
              },
              {
                "nombre": "Compromiso por ciberataques",
                "nivel": "Crítico",
                "procedimientoControl": "CP-350705"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-407490"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0027",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Tecnología de la Información",
              "Administración y Finanzas"
            ],
            "riesgos": []
          },
          {
            "nombre": "SUBDIVISION-0030",
            "nombreReal": null,
            "pais": "Chile",
            "areas": [
              "Administración y Finanzas",
              "Operaciones",
              "Recursos Humanos",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-353655"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Procesamiento ineficiente de pagos",
                "nivel": "Bajo",
                "procedimientoControl": "CP-351614"
              },
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351613"
              },
              {
                "nombre": "Compromiso por ciberataques",
                "nivel": "Crítico",
                "procedimientoControl": "CP-350622"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-407484"
              },
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-409669"
              },
              {
                "nombre": "Cambios no autorizados",
                "nivel": "Medio",
                "procedimientoControl": "CP-409673"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0008",
            "nombreReal": null,
            "pais": "Perú",
            "areas": [
              "Operaciones",
              "Recursos Humanos",
              "Tecnología de la Información",
              "Administración y Finanzas"
            ],
            "riesgos": [
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Procesamiento ineficiente de pagos",
                "nivel": "Bajo",
                "procedimientoControl": "CP-351972"
              },
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351971"
              },
              {
                "nombre": "Compromiso por ciberataques",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351274"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-407496"
              },
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-409707"
              },
              {
                "nombre": "Cambios no autorizados",
                "nivel": "Medio",
                "procedimientoControl": "CP-409711"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0036",
            "nombreReal": null,
            "pais": "Estados Unidos",
            "areas": [
              "Tecnología de la Información",
              "Administración y Finanzas",
              "Operaciones",
              "Recursos Humanos"
            ],
            "riesgos": [
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-918715"
              }
            ]
          }
        ]
      },
      {
        "nombre": "DIVISION-0005",
        "nombreReal": "Europa",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0038",
            "nombreReal": null,
            "pais": "Suiza",
            "areas": [
              "Seguridad de la Información",
              "Tecnología de la Información",
              "Administración y Finanzas",
              "Expansión e Infraestructura",
              "Operaciones",
              "Recursos Humanos",
              "Jurídico y Secretarías",
              "Cadena de Suministro"
            ],
            "riesgos": [
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-389695"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-418429"
              },
              {
                "nombre": "Sobrevaluación CxC",
                "nivel": "Medio",
                "procedimientoControl": "CP-365992"
              },
              {
                "nombre": "Sobrevaluación Efectivo",
                "nivel": "Medio",
                "procedimientoControl": "CP-365999"
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-830556"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0003",
            "nombreReal": null,
            "pais": "Alemania",
            "areas": [
              "Administración y Finanzas",
              "Cadena de Suministro",
              "Operaciones",
              "Recursos Humanos",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-918746"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "nombre": "UDN-0003",
    "nombreReal": "KOF",
    "departamento": "Beverage",
    "divisiones": [
      {
        "nombre": "DIVISION-0002",
        "nombreReal": "Brasil",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0002",
            "nombreReal": null,
            "pais": "Brasil",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Equipo frío, envase y pallets",
              "CAPEX",
              "Fletes",
              "Gastos de combustible",
              "Distribuidores",
              "Gestión de clientes",
              "Gestión de crédito de clientes",
              "Gestión de maestro de clientes",
              "Herramientas digitales",
              "Nómina",
              "Proveedores de Distribución",
              "Gestión de proveedores de transporte",
              "Inventarios producto terminado",
              "Auditoría de envases",
              "Tecnología de la Información",
              "Plataformas Digitales",
              "Manufactura",
              "Inventarios",
              "Mantenimiento",
              "Logística"
            ],
            "riesgos": [
              {
                "nombre": "Errors or omissions in the accounting close",
                "nivel": "Medio",
                "procedimientoControl": "CP-927899"
              },
              {
                "nombre": "Errors or omissions in the TCCC transaction log",
                "nivel": "Medio",
                "procedimientoControl": "CP-927900"
              },
              {
                "nombre": "Failure to comply with third-party carrier licenses and permits",
                "nivel": "Alto",
                "procedimientoControl": "CP-372460"
              },
              {
                "nombre": "Failure to comply with the labeling law",
                "nivel": "Alto",
                "procedimientoControl": "CP-372472"
              },
              {
                "nombre": "Violations of consumer rights",
                "nivel": "Alto",
                "procedimientoControl": "CP-372483"
              },
              {
                "nombre": "Omissions and errors in the recording of sales",
                "nivel": "Medio",
                "procedimientoControl": "CP-927901"
              },
              {
                "nombre": "Fraud in bank account management",
                "nivel": "Crítico",
                "procedimientoControl": "CP-381690"
              },
              {
                "nombre": "Failures in Portfolio Recovery",
                "nivel": "Bajo",
                "procedimientoControl": "CP-382504"
              },
              {
                "nombre": "Failure to meet approved credit limits",
                "nivel": "Bajo",
                "procedimientoControl": null
              },
              {
                "nombre": "Underestimation or Overestimation of Allowance for Doubtful Accounts",
                "nivel": "Bajo",
                "procedimientoControl": "CP-382548"
              },
              {
                "nombre": "Inadequate registration of finished product losses",
                "nivel": "Medio",
                "procedimientoControl": "CP-376778"
              },
              {
                "nombre": "Absence of regulatory frameworks",
                "nivel": "Bajo",
                "procedimientoControl": "CP-377586"
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377675"
              },
              {
                "nombre": "Inadequate delegation of authority",
                "nivel": "Medio",
                "procedimientoControl": "CP-377620"
              },
              {
                "nombre": "Failures in the recovery of receivables from miscellaneous debtors",
                "nivel": "Bajo",
                "procedimientoControl": "CP-927902"
              },
              {
                "nombre": "Excess transportation costs",
                "nivel": "Bajo",
                "procedimientoControl": "CP-373382"
              },
              {
                "nombre": "Unsafe conditions in transport",
                "nivel": "Alto",
                "procedimientoControl": "CP-928318"
              },
              {
                "nombre": "Distribution failure due to transport plan error",
                "nivel": "Medio",
                "procedimientoControl": "CP-928315"
              },
              {
                "nombre": "Financial loss due to lack of insurance and surety bond coverage",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928285"
              },
              {
                "nombre": "Errors or omissions in finished goods inventory records",
                "nivel": "Medio",
                "procedimientoControl": "CP-928947"
              },
              {
                "nombre": "Exploitation of OT vulnerabilities",
                "nivel": "Crítico",
                "procedimientoControl": "CP-918706"
              }
            ]
          }
        ]
      },
      {
        "nombre": "DIVISION-0003",
        "nombreReal": "Corporativo",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0016",
            "nombreReal": null,
            "pais": "Corporativo",
            "areas": [
              "Administración y Finanzas",
              "Jurídico y Secretarías",
              "Recursos Humanos",
              "Sostenibilidad y Energía",
              "Finanzas (Corporativo)",
              "Finanzas (KFS PF&R)",
              "Tecnología de la Información",
              "Auditoría",
              "Cumplimiento",
              "Sostenibilidad (Corporativo)",
              "Operativa",
              "Finanzas (KFS RTR)",
              "Finanzas (KFS CM)",
              "CAPEX",
              "Proveedores",
              "Autoevaluación Controles SOX",
              "Nómina",
              "Evaluación Sistema de GRyC",
              "Proveedores de Distribución",
              "Partes relacionadas",
              "Sostenibilidad (KFS RTR)",
              "Sostenibilidad (KFS CM)"
            ],
            "riesgos": [
              {
                "nombre": "Exploitation of IT vulnerabilities",
                "nivel": "Crítico",
                "procedimientoControl": "CP-348349"
              },
              {
                "nombre": "Non-compliance with the rules of bonds related to Sustainability",
                "nivel": "Alto",
                "procedimientoControl": "CP-372542"
              },
              {
                "nombre": "Errors or omissions in the integrated annual report",
                "nivel": "Medio",
                "procedimientoControl": "CP-372544"
              },
              {
                "nombre": "Unrecorded Liabilities at the end of the year",
                "nivel": "Medio",
                "procedimientoControl": "CP-927904"
              },
              {
                "nombre": "Fraud in bank account management",
                "nivel": "Crítico",
                "procedimientoControl": "CP-381692"
              },
              {
                "nombre": "Violations of consumer rights",
                "nivel": "Alto",
                "procedimientoControl": "CP-375838"
              },
              {
                "nombre": "Inadequate attention to visits by authorities",
                "nivel": "Medio",
                "procedimientoControl": "CP-376368"
              },
              {
                "nombre": "Absence of regulatory frameworks",
                "nivel": "Bajo",
                "procedimientoControl": "CP-377588"
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377677"
              },
              {
                "nombre": "Failures in the recovery of receivables from miscellaneous debtors",
                "nivel": "Bajo",
                "procedimientoControl": "CP-927905"
              },
              {
                "nombre": "Errors or omissions in the recording and disclosure of transactions with Related Parties",
                "nivel": "Medio",
                "procedimientoControl": "CP-488512"
              },
              {
                "nombre": "Incorrect allocation and recording of donations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-701234"
              }
            ]
          }
        ]
      },
      {
        "nombre": "DIVISION-0007",
        "nombreReal": "Latam",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0001",
            "nombreReal": null,
            "pais": "Argentina",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Equipo frío, envase y pallets",
              "CAPEX",
              "Fletes",
              "Gastos de combustible",
              "Proveedores",
              "Nómina",
              "Proveedores de Distribución",
              "Inventarios producto terminado",
              "Comercial",
              "Inventarios",
              "Manufactura",
              "Logística"
            ],
            "riesgos": [
              {
                "nombre": "Reputational impact due to inadequate incident and crisis management",
                "nivel": "Medio",
                "procedimientoControl": "CP-752473"
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377674"
              },
              {
                "nombre": "Incorrect allocation and recording of donations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-701235"
              },
              {
                "nombre": "Unsafe conditions in transport",
                "nivel": "Alto",
                "procedimientoControl": "CP-928326"
              },
              {
                "nombre": "Errors or omissions in finished goods inventory records",
                "nivel": "Medio",
                "procedimientoControl": "CP-928998"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0013",
            "nombreReal": null,
            "pais": "Colombia",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Equipo frío, envase y pallets",
              "CAPEX",
              "Gestión de clientes",
              "Gestión de crédito de clientes",
              "Gestión de maestro de clientes",
              "Herramientas digitales",
              "Nómina",
              "Proveedores de Distribución",
              "Transportes T1",
              "Gestión de proveedores de transporte",
              "Inventarios producto terminado",
              "Auditoría de envases",
              "Tecnología de la Información",
              "Plataformas Digitales",
              "Proveedores",
              "Inventarios",
              "Fletes",
              "Mantenimiento",
              "Manufactura",
              "Logística"
            ],
            "riesgos": [
              {
                "nombre": "Errors or omissions in the TCCC transaction log",
                "nivel": "Medio",
                "procedimientoControl": "CP-927906"
              },
              {
                "nombre": "Violations of consumer rights",
                "nivel": "Alto",
                "procedimientoControl": "CP-372485"
              },
              {
                "nombre": "Omissions and errors in the recording of sales",
                "nivel": "Medio",
                "procedimientoControl": "CP-927907"
              },
              {
                "nombre": "Improper credit notes to customers",
                "nivel": "Medio",
                "procedimientoControl": "CP-927908"
              },
              {
                "nombre": "Failure to comply with third-party carrier licenses and permits",
                "nivel": "Alto",
                "procedimientoControl": "CP-375830"
              },
              {
                "nombre": "Inadequate registration of finished product losses",
                "nivel": "Medio",
                "procedimientoControl": "CP-376779"
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377676"
              },
              {
                "nombre": "Inadequate delegation of authority",
                "nivel": "Medio",
                "procedimientoControl": "CP-377621"
              },
              {
                "nombre": "Excess spending on marketing actions",
                "nivel": "Bajo",
                "procedimientoControl": "CP-395490"
              },
              {
                "nombre": "Selection and hiring of suppliers not in accordance with internal regulations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928350"
              },
              {
                "nombre": "Unidentified and unmanaged technology assets",
                "nivel": "Bajo",
                "procedimientoControl": "CP-919140"
              },
              {
                "nombre": "Purchases outside internal policy",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928358"
              },
              {
                "nombre": "Exploitation of OT vulnerabilities",
                "nivel": "Crítico",
                "procedimientoControl": "CP-919144"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0017",
            "nombreReal": null,
            "pais": "Costa Rica",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Equipo frío, envase y pallets",
              "CAPEX",
              "Inventarios",
              "Distribuidores",
              "Gestión de clientes",
              "Gestión de maestro de clientes",
              "Nómina",
              "Proveedores de Distribución",
              "Comercial",
              "Proveedores",
              "Fletes",
              "Mantenimiento"
            ],
            "riesgos": [
              {
                "nombre": "Omissions and errors in the recording of sales",
                "nivel": "Medio",
                "procedimientoControl": "CP-927909"
              },
              {
                "nombre": "Unrecorded Liabilities at the end of the year",
                "nivel": "Medio",
                "procedimientoControl": "CP-927910"
              },
              {
                "nombre": "Failures in Portfolio Recovery",
                "nivel": "Bajo",
                "procedimientoControl": "CP-927911"
              },
              {
                "nombre": "Failure to meet approved credit limits",
                "nivel": "Bajo",
                "procedimientoControl": null
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377678"
              },
              {
                "nombre": "Excess spending on marketing actions",
                "nivel": "Bajo",
                "procedimientoControl": "CP-395432"
              },
              {
                "nombre": "Selection and hiring of suppliers not in accordance with internal regulations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-893077"
              },
              {
                "nombre": "Unsafe conditions in transport",
                "nivel": "Alto",
                "procedimientoControl": "CP-928319"
              },
              {
                "nombre": "Financial loss due to lack of insurance and surety bond coverage",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928288"
              },
              {
                "nombre": "Inadequate management of third-party inventories",
                "nivel": "Medio",
                "procedimientoControl": "CP-928333"
              },
              {
                "nombre": "Loss of products due to lack of transport safety",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928328"
              },
              {
                "nombre": "Loss of sales due to poor carrier performance",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928332"
              },
              {
                "nombre": "Loss of sales due to delivery route allocation failures",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928314"
              },
              {
                "nombre": "Errors or omissions in finished goods inventory records",
                "nivel": "Medio",
                "procedimientoControl": "CP-928955"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0025",
            "nombreReal": null,
            "pais": "Guatemala",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Equipo frío, envase y pallets",
              "CAPEX",
              "Fletes",
              "Gastos de combustible",
              "Inventarios",
              "Gestión de clientes",
              "Gestión de crédito de clientes",
              "Gestión de maestro de clientes",
              "Proveedores",
              "Nómina",
              "Proveedores de Distribución",
              "Transportes T1",
              "Gestión de proveedores de transporte",
              "Auditoría de envases",
              "Plataformas Digitales",
              "Mantenimiento",
              "Manufactura",
              "Logística"
            ],
            "riesgos": [
              {
                "nombre": "Errors or omissions in the accounting close",
                "nivel": "Medio",
                "procedimientoControl": "CP-927918"
              },
              {
                "nombre": "Errors or omissions in the TCCC transaction log",
                "nivel": "Medio",
                "procedimientoControl": "CP-927919"
              },
              {
                "nombre": "Inadequate attention to visits by authorities",
                "nivel": "Medio",
                "procedimientoControl": "CP-372454"
              },
              {
                "nombre": "Violations of consumer rights",
                "nivel": "Alto",
                "procedimientoControl": "CP-372487"
              },
              {
                "nombre": "Reputational impact due to inadequate incident and crisis management",
                "nivel": "Medio",
                "procedimientoControl": "CP-382802"
              },
              {
                "nombre": "Omissions and errors in the recording of sales",
                "nivel": "Medio",
                "procedimientoControl": "CP-927920"
              },
              {
                "nombre": "Improper credit notes to customers",
                "nivel": "Medio",
                "procedimientoControl": "CP-382545"
              },
              {
                "nombre": "Failures in Portfolio Recovery",
                "nivel": "Bajo",
                "procedimientoControl": "CP-382505"
              },
              {
                "nombre": "Failure to meet approved credit limits",
                "nivel": "Bajo",
                "procedimientoControl": null
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377679"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0029",
            "nombreReal": null,
            "pais": "Nicaragua",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Equipo frío, envase y pallets",
              "Inventarios",
              "Gestión de clientes",
              "Gestión de maestro de clientes",
              "Proveedores",
              "Nómina",
              "Proveedores de Distribución",
              "Auditoría de envases",
              "Fletes",
              "CAPEX"
            ],
            "riesgos": [
              {
                "nombre": "Omissions and errors in the recording of sales",
                "nivel": "Medio",
                "procedimientoControl": "CP-927924"
              },
              {
                "nombre": "Unrecorded Liabilities at the end of the year",
                "nivel": "Medio",
                "procedimientoControl": "CP-927925"
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377681"
              },
              {
                "nombre": "Excess spending on marketing actions",
                "nivel": "Bajo",
                "procedimientoControl": "CP-395433"
              },
              {
                "nombre": "Selection and hiring of suppliers not in accordance with internal regulations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-893079"
              },
              {
                "nombre": "Unsafe conditions in transport",
                "nivel": "Alto",
                "procedimientoControl": "CP-928322"
              },
              {
                "nombre": "Financial loss due to lack of insurance and surety bond coverage",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928289"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0031",
            "nombreReal": null,
            "pais": "Panamá",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Fletes",
              "Gastos de combustible",
              "Gestión de clientes",
              "Gestión de crédito de clientes",
              "Nómina",
              "Proveedores de Distribución",
              "Transportes T1",
              "Gestión de proveedores de transporte",
              "Inventarios producto terminado",
              "Comercial",
              "Equipo frío, envase y pallets",
              "Inventarios"
            ],
            "riesgos": [
              {
                "nombre": "Omissions and errors in the recording of sales",
                "nivel": "Medio",
                "procedimientoControl": "CP-927927"
              },
              {
                "nombre": "Unrecorded Liabilities at the end of the year",
                "nivel": "Medio",
                "procedimientoControl": "CP-927928"
              },
              {
                "nombre": "Failures in Portfolio Recovery",
                "nivel": "Bajo",
                "procedimientoControl": "CP-927929"
              },
              {
                "nombre": "Failure to meet approved credit limits",
                "nivel": "Bajo",
                "procedimientoControl": null
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377682"
              },
              {
                "nombre": "Selection and hiring of suppliers not in accordance with internal regulations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-381750"
              },
              {
                "nombre": "Financial loss due to lack of insurance and surety bond coverage",
                "nivel": "Bajo",
                "procedimientoControl": "CP-503731"
              },
              {
                "nombre": "Unsafe conditions in transport",
                "nivel": "Alto",
                "procedimientoControl": "CP-503720"
              },
              {
                "nombre": "Excess spending on marketing actions",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928338"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0037",
            "nombreReal": null,
            "pais": "Uruguay",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Equipo frío, envase y pallets",
              "Proveedores",
              "Nómina",
              "Proveedores de Distribución",
              "Inventarios producto terminado",
              "Comercial",
              "Inventarios",
              "Fletes"
            ],
            "riesgos": [
              {
                "nombre": "Reputational impact due to inadequate incident and crisis management",
                "nivel": "Medio",
                "procedimientoControl": "CP-752497"
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377683"
              },
              {
                "nombre": "Unsafe conditions in transport",
                "nivel": "Alto",
                "procedimientoControl": "CP-928325"
              },
              {
                "nombre": "Financial loss due to lack of insurance and surety bond coverage",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928286"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0039",
            "nombreReal": null,
            "pais": "Venezuela",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Fletes",
              "Gastos de combustible",
              "Inventarios",
              "Distribuidores",
              "Proveedores",
              "Nómina",
              "Proveedores de Distribución",
              "Gestión de proveedores de transporte",
              "Comercial",
              "Equipo frío, envase y pallets",
              "Mantenimiento",
              "Manufactura",
              "Logística"
            ],
            "riesgos": [
              {
                "nombre": "Reputational impact due to inadequate incident and crisis management",
                "nivel": "Medio",
                "procedimientoControl": "CP-373401"
              },
              {
                "nombre": "Failure to comply with third-party carrier licenses and permits",
                "nivel": "Alto",
                "procedimientoControl": "CP-375836"
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377684"
              },
              {
                "nombre": "Incorrect allocation and recording of donations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-373439"
              },
              {
                "nombre": "Unsafe conditions in transport",
                "nivel": "Alto",
                "procedimientoControl": "CP-928324"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0004",
            "nombreReal": null,
            "pais": "Centroamérica Sur",
            "areas": [
              "Cumplimiento",
              "Proveedores",
              "Proveedores de Distribución",
              "Finanzas",
              "Sostenibilidad"
            ],
            "riesgos": [
              {
                "nombre": "Incorrect allocation and recording of donations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928212"
              }
            ]
          }
        ]
      },
      {
        "nombre": "DIVISION-0008",
        "nombreReal": "México",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0028",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Finanzas",
              "Cumplimiento",
              "Sostenibilidad",
              "Operativa",
              "Equipo frío, envase y pallets",
              "CAPEX",
              "Inventarios",
              "Distribuidores",
              "Herramientas digitales",
              "Nómina",
              "Proveedores",
              "Proveedores de Distribución",
              "Transportes T1",
              "Auditoría de envases",
              "Tecnología de la Información",
              "Comercial",
              "Manufactura",
              "Fletes",
              "Mantenimiento",
              "Logística"
            ],
            "riesgos": [
              {
                "nombre": "Errors or omissions in the TCCC transaction log",
                "nivel": "Medio",
                "procedimientoControl": "CP-927926"
              },
              {
                "nombre": "Inadequate registration of finished product losses",
                "nivel": "Medio",
                "procedimientoControl": "CP-347113"
              },
              {
                "nombre": "Failure to comply with the labeling law",
                "nivel": "Alto",
                "procedimientoControl": "CP-372476"
              },
              {
                "nombre": "Violations of consumer rights",
                "nivel": "Alto",
                "procedimientoControl": "CP-372488"
              },
              {
                "nombre": "Omissions and errors in the recording of sales",
                "nivel": "Medio",
                "procedimientoControl": null
              },
              {
                "nombre": "Fraud in bank account management",
                "nivel": "Crítico",
                "procedimientoControl": "CP-381710"
              },
              {
                "nombre": "Improper credit notes to customers",
                "nivel": "Medio",
                "procedimientoControl": "CP-373457"
              },
              {
                "nombre": "Absence of regulatory frameworks",
                "nivel": "Bajo",
                "procedimientoControl": "CP-377591"
              },
              {
                "nombre": "Conflict of interest",
                "nivel": "Alto",
                "procedimientoControl": "CP-377680"
              },
              {
                "nombre": "Inadequate delegation of authority",
                "nivel": "Medio",
                "procedimientoControl": "CP-377625"
              },
              {
                "nombre": "Failures in the recovery of receivables from miscellaneous debtors",
                "nivel": "Bajo",
                "procedimientoControl": "CP-382498"
              },
              {
                "nombre": "Errors or omissions in finished goods inventory records",
                "nivel": "Medio",
                "procedimientoControl": "CP-381771"
              },
              {
                "nombre": "Failures in the physical management of finished goods",
                "nivel": "Bajo",
                "procedimientoControl": "CP-381810"
              },
              {
                "nombre": "Excess transportation costs",
                "nivel": "Bajo",
                "procedimientoControl": "CP-503694"
              },
              {
                "nombre": "Loss of sales due to poor carrier performance",
                "nivel": "Bajo",
                "procedimientoControl": "CP-503695"
              },
              {
                "nombre": "Financial loss due to lack of insurance and surety bond coverage",
                "nivel": "Bajo",
                "procedimientoControl": "CP-503703"
              },
              {
                "nombre": "Incorrect allocation and recording of donations",
                "nivel": "Bajo",
                "procedimientoControl": "CP-373440"
              },
              {
                "nombre": "Unidentified and unmanaged technology assets",
                "nivel": "Bajo",
                "procedimientoControl": "CP-888919"
              },
              {
                "nombre": "Loss of products due to lack of transport safety",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928327"
              },
              {
                "nombre": "Excess spending on marketing actions",
                "nivel": "Bajo",
                "procedimientoControl": "CP-928339"
              },
              {
                "nombre": "Exploitation of OT vulnerabilities",
                "nivel": "Crítico",
                "procedimientoControl": "CP-888924"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "nombre": "UDN-0005",
    "nombreReal": "FEMSA Servicios",
    "departamento": "Retail & Spin",
    "divisiones": [
      {
        "nombre": "DIVISION-0011",
        "nombreReal": null,
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0019",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Administración y Finanzas",
              "Recursos Humanos",
              "Tecnología de la Información",
              "Operaciones"
            ],
            "riesgos": [
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-353434"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Ambiente de control deficiente",
                "nivel": "Bajo",
                "procedimientoControl": "CP-350726"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0014",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Operaciones",
              "Administración y Finanzas",
              "Recursos Humanos",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Acceso no autorizado",
                "nivel": "Alto",
                "procedimientoControl": "CP-350738"
              },
              {
                "nombre": "Cambios no autorizados",
                "nivel": "Medio",
                "procedimientoControl": "CP-350788"
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-352272"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Compromiso por ciberataques",
                "nivel": "Crítico",
                "procedimientoControl": "CP-350739"
              },
              {
                "nombre": "Interrupción o degradación del servicio",
                "nivel": "Medio",
                "procedimientoControl": "CP-350740"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-407395"
              },
              {
                "nombre": "Sobrevaluación Efectivo",
                "nivel": "Medio",
                "procedimientoControl": "CP-353444"
              },
              {
                "nombre": "Incumplimiento a reglas SPEI",
                "nivel": "Alto",
                "procedimientoControl": "CP-894893"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0033",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Administración y Finanzas"
            ],
            "riesgos": [
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": null
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "nombre": "UDN-0002",
    "nombreReal": "Spin",
    "departamento": "Retail & Spin",
    "divisiones": [
      {
        "nombre": "DIVISION-0006",
        "nombreReal": "Spin",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0020",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Seguridad de la Información",
              "Administración y Finanzas",
              "Jurídico y Secretarías",
              "Recursos Humanos",
              "Sostenibilidad y Energía",
              "Tecnología de la Información",
              "Operaciones"
            ],
            "riesgos": [
              {
                "nombre": "Sobrevaluación Efectivo",
                "nivel": "Medio",
                "procedimientoControl": "CP-352941"
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-353474"
              },
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Explotación infantil",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351440"
              },
              {
                "nombre": "Procesamiento ineficiente de pagos",
                "nivel": "Bajo",
                "procedimientoControl": "CP-848933"
              },
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351744"
              },
              {
                "nombre": "Subvaluación CxP",
                "nivel": "Medio",
                "procedimientoControl": "CP-352943"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-407374"
              },
              {
                "nombre": "Sobrevaluación CxC",
                "nivel": "Medio",
                "procedimientoControl": "CP-352959"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0011",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Administración y Finanzas",
              "Cadena de Suministro",
              "Recursos Humanos",
              "Tecnología de la Información"
            ],
            "riesgos": [
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Procesamiento ineficiente de pagos",
                "nivel": "Bajo",
                "procedimientoControl": "CP-351749"
              },
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-351750"
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-937370"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0005",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Tecnología de la Información",
              "Administración y Finanzas",
              "Operaciones",
              "Recursos Humanos"
            ],
            "riesgos": [
              {
                "nombre": "Desviaciones éticas",
                "nivel": "Alto",
                "procedimientoControl": null
              },
              {
                "nombre": "Colusión en proceso de compras",
                "nivel": "Crítico",
                "procedimientoControl": "CP-848935"
              },
              {
                "nombre": "Procesamiento ineficiente de pagos",
                "nivel": "Bajo",
                "procedimientoControl": "CP-937988"
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-937359"
              }
            ]
          },
          {
            "nombre": "SUBDIVISION-0024",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Administración y Finanzas"
            ],
            "riesgos": [
              {
                "nombre": "Sobrevaluación Efectivo",
                "nivel": "Medio",
                "procedimientoControl": "CP-352945"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "nombre": "UDN-0001",
    "nombreReal": "Deportes",
    "departamento": "Retail & Spin",
    "divisiones": [
      {
        "nombre": "DIVISION-0004",
        "nombreReal": "Deportes",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0012",
            "nombreReal": null,
            "pais": "México",
            "areas": [
              "Tecnología de la Información",
              "Administración y Finanzas",
              "Deportiva",
              "Operaciones"
            ],
            "riesgos": [
              {
                "nombre": "Uso indebido de fondos de tesorería",
                "nivel": "Alto",
                "procedimientoControl": "CP-894924"
              },
              {
                "nombre": "Condiciones inseguras",
                "nivel": "Alto",
                "procedimientoControl": "CP-937489"
              },
              {
                "nombre": "Explotación infantil",
                "nivel": "Crítico",
                "procedimientoControl": "CP-937514"
              },
              {
                "nombre": "Sobrevaluación Efectivo",
                "nivel": "Medio",
                "procedimientoControl": "CP-936877"
              },
              {
                "nombre": "Sobrevaluación Intangibles",
                "nivel": "Medio",
                "procedimientoControl": "CP-936998"
              },
              {
                "nombre": "Cierre Contable / Consolidación",
                "nivel": "Medio",
                "procedimientoControl": "CP-936868"
              },
              {
                "nombre": "Uso indebido de datos personales",
                "nivel": "Alto",
                "procedimientoControl": "CP-937041"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "nombre": "UDN-0006",
    "nombreReal": "Tragetta",
    "departamento": "Beverage",
    "divisiones": [
      {
        "nombre": "DIVISION-0012",
        "nombreReal": "Tragetta",
        "subdivisiones": [
          {
            "nombre": "SUBDIVISION-0002",
            "nombreReal": null,
            "pais": "Brasil",
            "areas": [
              "Inventarios",
              "Cumplimiento",
              "Finanzas",
              "Sostenibilidad",
              "Tecnología de Información",
              "Gestión de combustible",
              "Comercial",
              "Mantenimiento",
              "Gestión de Terceros",
              "Proveedores",
              "Nómina",
              "Compras",
              "Recursos Humanos",
              "Operativa"
            ],
            "riesgos": [
              {
                "nombre": "Lack of cybersecurity awareness",
                "nivel": "Bajo",
                "procedimientoControl": "CP-474103"
              },
              {
                "nombre": "Compromised credentials",
                "nivel": "Crítico",
                "procedimientoControl": "CP-843548"
              },
              {
                "nombre": "Unauthorized network traffic",
                "nivel": "Crítico",
                "procedimientoControl": "CP-919135"
              },
              {
                "nombre": "Misuse of suspense accounts",
                "nivel": "Alto",
                "procedimientoControl": "CP-923146"
              },
              {
                "nombre": "Errors or omissions in lease registration",
                "nivel": "Medio",
                "procedimientoControl": "CP-923147"
              },
              {
                "nombre": "Failure to comply with data protection and privacy requirements",
                "nivel": "Alto",
                "procedimientoControl": "CP-923757"
              }
            ]
          }
        ]
      }
    ]
  }
];

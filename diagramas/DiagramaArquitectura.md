```mermaid

flowchart TD
    A["Entra ID SSID Corporativo"]

    subgraph NAV["Navegador del usuario<br/>(React y Javascript)"]
        SPA["SPA Expedite"]
    end

    subgraph BE["Backend Expedite<br/>(node.js, Express.js)"]
        direction TB
        EXP["<b>Capa de exposicion</b><br/>Valida token, resuelve rol, registra eventos"]
        NEG["<b>Capa de negocio</b><br/>Modulos M1 a M4, y MT1 a MT5"]
        INT["<b>Capa de integracion</b><br/>Tres gateways independientes"]
        EXP ~~~ NEG ~~~ INT
    end

    subgraph APIS["Capa de APIs"]
        direction LR
        API1["<b>API REST</b><br/>JSON"]
        API2["<b>API REST</b><br/>XML"]
        API3["<b>Microsoft Graph API</b>"]
    end

    SQL["<b>Azure SQL Database</b><br/>(SQL)"]
    BLOB["<b>Azure Blob Storage</b><br/>(Almacenamiento de archivos)"]
    COP["<b>Copilot Premium</b><br/>Resumenes IA"]

    A --> NAV
    NAV --> BE
    INT --> API1
    INT --> API2
    INT --> API3
    API1 --> SQL
    API2 --> BLOB
    API3 --> COP

    %% Negocio = lila, TI = amarillo, Aplicativa = cyan, Infraestructura = verde
    classDef negocio fill:#CCCCFF,stroke:#000,color:#000
    classDef ti fill:#FFFFB5,stroke:#000,color:#000
    classDef aplicativa fill:#B5FFFF,stroke:#000,color:#000
    classDef infraestructura fill:#C9E7B7,stroke:#000,color:#000

    class NEG negocio
    class A,API1,API2,API3,COP ti
    class SPA,EXP,INT aplicativa
    class SQL,BLOB infraestructura

    style NAV fill:#DFFFFF,stroke:#000,color:#000
    style BE fill:#DFFFFF,stroke:#000,color:#000
    style APIS fill:#FFFFDF,stroke:#000,color:#000

    ```
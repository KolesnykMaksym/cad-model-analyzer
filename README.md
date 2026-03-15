# CAD Model Analyzer

Automated system for analyzing 3D CAD models using Claude AI. Extracts design parameters, validates tolerances, and generates technical reports for mechanical designs.

## Features

- **Automated CAD Analysis**: Parse and analyze FreeCAD, OpenSCAD, and STEP files
- **Design Validation**: Check tolerances, fits (ISO 286), and GD&T specifications
- **Technical Report Generation**: Create detailed analysis reports with recommendations
- **Component Specification Extraction**: Identify dimensions, materials, and manufacturing requirements
- **Assembly Compatibility Check**: Validate part mating and interference detection

## Use Cases

- **Mechanical Design Review**: Automated analysis of motor housings, brackets, enclosures
- **Manufacturing Feasibility**: Check machinability, assembly complexity, and tooling requirements
- **Design Optimization**: Identify areas for cost reduction and performance improvement
- **Quality Assurance**: Validate designs against ISO standards and best practices

## Technology Stack

- **Python 3.9+**: Core automation framework
- **Claude AI (Anthropic)**: Natural language understanding for design analysis
- **FreeCAD Python API**: CAD file parsing and geometry extraction
- **OpenSCAD**: Parametric model generation
- **ISO Standards**: ISO 286 (fits), ISO 2768 (general tolerances), ISO 1101 (GD&T)

## Example Analysis

```python
from cad_analyzer import CADAnalyzer

analyzer = CADAnalyzer(api_key="your_anthropic_key")

# Analyze motor housing design
result = analyzer.analyze_file("motor_housing.step",
    requirements={
        "material": "6061-T6 Aluminum",
        "max_temp": 120,
        "tolerance_class": "ISO 2768-m"
    }
)

print(result.summary)
# Output: "Design feasible. Recommend increasing wall thickness from 2mm to 2.5mm
# in high-stress areas. Cost estimate: $45/unit (CNC machining, qty 100)."
```

## Installation

```bash
pip install cad-model-analyzer
```

## Related Projects

- **PLFM Radar Analysis**: Range calculations for 10.5 GHz phased array radar
- **Supplier Price Research**: Procurement automation for neodymium magnets and fiber optic components

## License

MIT License

## Author

Maksym Kolesnyk - Mechanical Design & Automation Engineer

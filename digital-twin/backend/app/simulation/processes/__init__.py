"""__init__.py for processes module"""
from app.simulation.processes.press import PressSimulator
from app.simulation.processes.welding import WeldingSimulator
from app.simulation.processes.body_assembly import BodyAssemblySimulator
from app.simulation.processes.paint import PaintSimulator
from app.simulation.processes.engine import EngineSimulator
from app.simulation.processes.windshield import WindshieldSimulator

__all__ = [
    'PressSimulator',
    'WeldingSimulator',
    'BodyAssemblySimulator',
    'PaintSimulator',
    'EngineSimulator',
    'WindshieldSimulator'
]

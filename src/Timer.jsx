export default class Timer extends React.Component {
    constructor(props) {
        super(props);
        this.config = props.config;
        
        let nowDate = Date.now();
        
        let timeElapsed = Date.now() - props.timer;
        timeElapsed = timeElapsed / 1000;
        
        let timeSeconds = props.limit * 60;
        
        timeSeconds = timeSeconds - timeElapsed;
        
        if (timeSeconds < 0) {
            timeSeconds = 0;
        }
        
        this.state = {
            timeSeconds: timeSeconds,
            timer: 'Loading'
        }
    }
    
    componentDidMount() {
        this.timerID = setInterval(
            () => this.tick(),
            1000
        );
    }
    
    componentWillUnmount() {
        clearInterval(this.timerID);
    }
    
    getTimeStr(seconds) {
        let format = (val) => `0${Math.floor(val)}`.slice(-2);
        let hours = seconds / 3600;
        let minutes = (seconds % 3600) / 60;
        return [hours, minutes, seconds % 60].map(format).join(':');
    }
    
    tick() {
        let timeSeconds = this.state.timeSeconds - 1;
        
        if (timeSeconds <= 0) {
            timeSeconds = 0;
            clearInterval(this.timerID);
        }
        
        this.setState({
            timeSeconds: timeSeconds,
            timer: this.getTimeStr(timeSeconds)
        });
    }
    
    render() {
        return (
            <div className="timer">
                <h2 className="timerLabel">Timer:</h2>
                <h2 className="timerValue">{this.state.timer}</h2>
            </div>
        );
    }
}

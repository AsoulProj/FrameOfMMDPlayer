let MMDPlayManager = class {

    maxPlayEnd = -1;
    minPlayEnd = -1;

    constructor(params = {}, ClassOfDurationData) {
        this.configuration = {
            loopPlay: params.loopPlay || false,
            playEnd: params.playEnd || "minPlayEnd",

        }
        if (ClassOfDurationData != undefined) {
            if (durationDatas.constructor.name == 'DurationData') {
                this.totalDuration = ClassOfDurationData.totalDuration;
                for (const key in totalDuration) {
                    if (totalDuration[key] > 0) {
                        if (totalDuration[key] > maxPlayEnd)
                            this.maxPlayEnd = totalDuration[key]
                        if (totalDuration[key] < minPlayEnd || minPlayEnd < 0)
                            this.minPlayEnd = totalDuration[key]
                    }
                }
            } else throw new Error("MMDPlayManager: Unvaild instance. Use DurationData instance");
        }
    }

    rePlay() {

    }

    //检查中断暂停的位置，之后再决定是否继续播放
    checkPlayEnd(duration) {
        if (maxPlayEnd < 0 && minPlayEnd < 0) {

        }

        if (playEnd == "minPlayEnd") {
            return duration >= this.minPlayEnd;
        else
            return duration >=
    }
}
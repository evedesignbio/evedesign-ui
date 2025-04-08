import '@mantine/core/styles.css';
import {MantineProvider} from '@mantine/core';
import {Route, Switch} from "wouter";
import {SubmissionPage} from "./pages/submission.tsx";

const App = () => {
    return (
        <MantineProvider>
            <Switch>
                <Route path="/" component={SubmissionPage}/>
            </Switch>
        </MantineProvider>
    );
}

export default App

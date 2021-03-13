import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Markdown from 'components/Markdown';

const useStyles = makeStyles((theme) => ({
  sidebarAboutBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[200],
  },
  sidebarSection: {
    marginTop: theme.spacing(3),
  },
}));

interface SidebarProps {
  description: string;
  title: string;
}

export default function Sidebar(props: SidebarProps) {
  const classes = useStyles();
  const { description, title } = props;
  const [loadedAbout, setLoadedAbout] = React.useState<string>('');
  React.useEffect(() => {
    setLoadedAbout('');
    fetch(description)
    .then(data => data.text())
    .then(text => {
      setLoadedAbout(text);
    });
  }, [description]);

  return (
    <Grid item xs={12} md={4}>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Markdown>{loadedAbout}</Markdown>
      </Paper>
    </Grid>
  );
}

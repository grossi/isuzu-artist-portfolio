import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import { useLanguage } from 'i18n/LanguageContext';

const useStyles = makeStyles((theme) => ({
  footer: {
    backgroundColor: theme.palette.background.paper,
    marginTop: theme.spacing(8),
    padding: theme.spacing(2),
  },
}));

export default function Footer() {
  const classes = useStyles();
  const { t } = useLanguage();

  return (
    <footer className={classes.footer}>
      <Container maxWidth="lg">
        <Typography variant="body2" color="textSecondary" align="center">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </Typography>
      </Container>
    </footer>
  );
}
